const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");
const {
  handleConcerns,
  handleDateOfBirth,
  handleEmail,
  handleHeight,
  handlePregnancyWeeks,
  handlePrenatal,
  handleSpecialPage,
  handleWeight,
  handleWhatMedsPage,
} = require("./handlePages");
const { goBack, goNext } = require("./navigation");

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const payloadFolder = "captured_payloads";
  const stateFolder = "quiz_states";
  const stateFile = path.join(stateFolder, "quiz_state.json");
  const maxPayloads = 500;
  let payloadCounter = 0;
  let payloadsProcessedBefore = 0;
  let decisionStack = [];
  let pageOptions = new Map();
  let stateLoaded = false;
  let previousURL = "";

  // Helper function to check if a file exists
  async function fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Save current state
  async function saveState() {
    // Ensure the states folder exists
    try {
      await fs.mkdir(stateFolder, { recursive: true });
      console.log(`Ensured the state folder exists: ${stateFolder}`);
    } catch (error) {
      console.error(`Error creating state folder: ${error.message}`);
    }

    const data = {
      savedStack: decisionStack,
      savedOptions: Array.from(pageOptions),
      processedPayloads: payloadCounter,
    };

    // Backup the current state file if it exists
    if (await fileExists(stateFile)) {
      const backupFileName = path.join(
        stateFolder,
        `quiz_state_${payloadsProcessedBefore}.json`
      );
      await fs.rename(stateFile, backupFileName);
      console.log(`Backup of old state saved as: ${backupFileName}`);
    }

    // Save the new state file
    await fs.writeFile(stateFile, JSON.stringify(data, null, 2), "utf8");
    console.log("State saved.");
  }

  // Load previous state if exists
  async function loadState() {
    try {
      const data = await fs.readFile(stateFile, "utf8");
      const { savedStack, savedOptions, processedPayloads } = JSON.parse(data);
      decisionStack = savedStack;
      pageOptions = new Map(savedOptions);
      payloadsProcessedBefore = processedPayloads || 0;
      payloadCounter = processedPayloads; // Start numbering from last processed
      stateLoaded = true;
      console.log(
        `Loaded previous state. Total payloads processed: ${processedPayloads}`
      );
    } catch (error) {
      console.log("No previous state found. Starting fresh.");
    }
  }

  await fs.mkdir(payloadFolder, { recursive: true });
  await loadState();

  // Prevent navigation away from /loading except for "go back"
  await page.evaluate(() => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    let allowGoBack = false;

    // Override pushState to block navigation
    history.pushState = function (...args) {
      if (!allowGoBack && location.pathname === "/loading") {
        console.log("Blocked navigation from /loading");
        return;
      }
      originalPushState.apply(history, args);
    };

    // Override replaceState to block navigation
    history.replaceState = function (...args) {
      if (!allowGoBack && location.pathname === "/loading") {
        console.log("Blocked navigation from /loading");
        return;
      }
      originalReplaceState.apply(history, args);
    };

    // Listen for popstate events (e.g., browser back/forward actions)
    window.addEventListener("popstate", () => {
      allowGoBack = true; // Allow go back
      setTimeout(() => {
        allowGoBack = false; // Reset after a short delay
      }, 100);
    });
  });

  // List of domains to block
  const blockedUrls = [
    "https://analytics.google.com/**",
    "https://analytics.tiktok.com/**",
    "https://www.facebook.com/**",
    "https://www.googletagmanager.com/**",
    "https://td.doubleclick.net/**",
    "https://googleads.g.doubleclick.net/**",
    "https://www.inflektionshop.com/**",
    "https://googleads.g.doubleclick.net/**",
    "https://www.google.co.in/**",
  ];

  // Block requests to the specified URLs
  await page.route("**", (route) => {
    const url = route.request().url();
    if (
      blockedUrls.some((pattern) => url.startsWith(pattern.replace("/**", "")))
    ) {
      route.abort();
    } else {
      route.continue();
    }
  });

  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "image") route.abort();
    else route.continue();
  });

  // Intercept API requests to capture payloads
  page.on("request", async (request) => {
    if (payloadCounter >= maxPayloads + payloadsProcessedBefore) return;
    if (request.url().includes("/formula_recommendations/from_answers")) {
      const payload = request.postData();
      if (payload) {
        const fileName = path.join(
          payloadFolder,
          `payload_${++payloadCounter}.json`
        );
        console.log(`Captured Payload #${payloadCounter}:`, payload);
        await fs.writeFile(
          fileName,
          JSON.stringify(JSON.parse(payload), null, 2),
          "utf8"
        );
      }
    }
  });

  // Mock API responses to prevent hitting the server
  await page.route("**/formula_recommendations/from_answers", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Mocked response" }),
    });
  });

  // Refresh options dynamically
  async function refreshOptions() {
    let options = await page.$$(".option-list .option");
    if (options.length > 0) {
      let optionsSelected = await page.$$(".option-list .option.selected");
      if (optionsSelected.length > 0) {
        for (let i = 0; i < optionsSelected.length; i++) {
          await optionsSelected[i].click();
          await page.waitForTimeout(200);
        }
      }
      return options;
    }
    options = await page.$$(".yes-no-boxes .option");
    return options;
  }

  // Function to explore the quiz
  async function exploreQuiz() {
    const currentURL = page.url().split("/")[3];
    console.log(`Exploring path: ${currentURL}`);

    if (currentURL === previousURL) {
      console.log("Already explored this page, skipping...");
      return;
    }
    previousURL = currentURL;

    if (currentURL === "section-intro") {
      pageOptions.set(currentURL, ["null"]);
      if (await page.getByLabel("Accept all cookies").isVisible())
        await page.getByLabel("Accept all cookies").click();
    } else if (currentURL === "loading") {
      decisionStack.push({ questionURL: currentURL, option: "null" });
      pageOptions.set(currentURL, []);
      console.log("Loading page loaded.");
    } else if (currentURL === "concerns") {
      await handleConcerns(currentURL, page, pageOptions);
    } else if (
      currentURL === "skin-issues" ||
      currentURL === "injuries" ||
      currentURL === "medical-condition" ||
      currentURL === "allergic" ||
      currentURL === "libido-simptoms"
    ) {
      await handleSpecialPage(currentURL, page, pageOptions);
    } else if (currentURL === "which-best-describes") {
      await handlePrenatal(currentURL, page, pageOptions);
    } else if (currentURL === "pregnancy-weeks") {
      await handlePregnancyWeeks(currentURL, page, pageOptions);
    } else if (currentURL === "what-meds") {
      await handleWhatMedsPage(currentURL, page, pageOptions);
    } else if (currentURL === "date-of-birth") {
      await handleDateOfBirth(currentURL, page, pageOptions);
    } else if (currentURL === "height") {
      await handleHeight(currentURL, page, pageOptions);
    } else if (currentURL === "weight") {
      await handleWeight(currentURL, page, pageOptions);
    } else if (currentURL === "e-mail") {
      await handleEmail(currentURL, page, pageOptions);
    } else {
      // Refresh options
      let options = await refreshOptions();

      if (options.length > 0) {
        if (pageOptions.get(currentURL) === undefined)
          pageOptions.set(currentURL, [...Array(options.length).keys()]);
        if (pageOptions.get(currentURL).length > 0) {
          const op = await pageOptions.get(currentURL)[0];
          const optionText = await options[op].textContent();
          console.log(`Trying option: ${optionText}`);
          await options[op].click();
          await page.waitForTimeout(200);
        }
      } else {
        // If no options, check for input fields
        const inputs = await page.$$(
          "input:visible, textarea:visible, select:visible"
        );

        if (pageOptions.get(currentURL) === undefined && inputs.length > 0)
          pageOptions.set(currentURL, ["John Doe"]);

        if (inputs.length > 0 && pageOptions.get(currentURL).length > 0) {
          for (const input of inputs) {
            const inputType = await input.getAttribute("type");
            const inputValue = pageOptions.get(currentURL)[0];
            console.log(`Filling input field with value: ${inputValue}`);

            if (inputType === "text" || inputType === "textarea") {
              await input.fill(inputValue);
            }
            await page.waitForTimeout(200);
          }
        } else {
          if (pageOptions.get(currentURL) === undefined)
            pageOptions.set(currentURL, ["null"]);
        }
      }
    }

    if (
      pageOptions.get(currentURL) !== undefined &&
      pageOptions.get(currentURL).length === 0
    ) {
      pageOptions.delete(currentURL);
      decisionStack.pop();
      if (currentURL === "section-intro") return;
      await goBack(page);
    } else if (pageOptions.get(currentURL) !== undefined) {
      const options = pageOptions.get(currentURL);
      const option = options.shift();
      if (
        decisionStack.length > 0 &&
        decisionStack[decisionStack.length - 1].questionURL === currentURL
      )
        decisionStack.pop();
      decisionStack.push({ questionURL: currentURL, option });
      if (currentURL !== "e-mail") await goNext(page);
    }
  }

  async function traverseToCurrentState() {
    console.log("Traversing to the saved state...");
    for (const { questionURL, option } of decisionStack) {
      if (questionURL === "section-intro") {
        if (await page.getByLabel("Accept all cookies").isVisible())
          await page.getByLabel("Accept all cookies").click();
      } else if (
        questionURL === "concerns" ||
        questionURL === "which-best-describes" ||
        questionURL === "skin-issues" ||
        questionURL === "injuries" ||
        questionURL === "medical-condition" ||
        questionURL === "allergic" ||
        questionURL === "libido-simptoms"
      ) {
        const options = await page.$$(".option-list .option");
        for (const index of option) {
          await options[index].click();
          await page.waitForTimeout(200);
        }
      } else if (questionURL === "pregnancy-weeks") {
        const weekInput = await page.$('input[type="text"][name="question09"]');
        await weekInput.fill(String(option));
        await page.waitForTimeout(200);
      } else if (questionURL === "what-meds") {
        for (const medication of option) {
          await page.getByRole("textbox").click();
          await page.getByRole("textbox").fill(medication);
          await page.getByText(medication, { exact: true }).click();
          await page.waitForTimeout(200);
        }
      } else if (questionURL === "date-of-birth") {
        const dateInput = await page.$('input[type="text"][name="birthdate"]');
        await dateInput.fill(option);
        await page.waitForTimeout(200);
      } else if (questionURL === "height") {
        const heightInput = await page.$(
          'input[type="text"][name="question03"]'
        );
        await heightInput.fill(option);
        await page.waitForTimeout(200);
      } else if (questionURL === "weight") {
        const weightInput = await page.$(
          'input[type="text"][name="question04"]'
        );
        await weightInput.fill(option);
        await page.waitForTimeout(200);
      } else if (questionURL === "e-mail") {
        const emailInput = await page.$(
          'input[type="text"][name="question73"]'
        );
        await emailInput.fill(option);
        await page.waitForTimeout(200);
      } else {
        // Refresh options
        let options = await refreshOptions();

        if (options.length > 0) {
          await options[option].click();
          await page.waitForTimeout(200);
        } else {
          // If no options, check for input fields
          const inputs = await page.$$(
            "input:visible, textarea:visible, select:visible"
          );

          if (inputs.length > 0) {
            for (const input of inputs) {
              const inputType = await input.getAttribute("type");

              if (inputType === "text" || inputType === "textarea") {
                await input.fill(option);
              }
              await page.waitForTimeout(200);
            }
          }
        }
      }
      if (questionURL !== "e-mail") await goNext(page);
    }
    console.log("Reached the saved state.");
  }

  async function startExploringQuiz() {
    await page.goto("https://go-checkout.bioniq.com/section-intro");
    if (stateLoaded) {
      await traverseToCurrentState();
    }

    await exploreQuiz();

    // Repeat the process until you reach the end or a stopping condition is met
    let isPageChanged = true;
    while (isPageChanged) {
      const currentURL = page.url().split("/")[3];
      if (
        currentURL !== previousURL &&
        payloadCounter !== maxPayloads + payloadsProcessedBefore
      ) {
        await exploreQuiz();
      } else {
        isPageChanged = false; // Stop if the page hasn't changed
      }
    }

    console.log("All paths explored.");
    await saveState();
    await context.close();
    await browser.close();
  }

  await startExploringQuiz();
})();
