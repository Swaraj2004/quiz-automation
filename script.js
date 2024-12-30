const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Folder to store payloads
  const payloadFolder = "captured_payloads";
  await fs.mkdir(payloadFolder, { recursive: true });

  let stop = 0;
  let payloadCounter = 0;
  const decisionStack = [];
  const pageOptions = new Map();

  // Intercept API requests to capture payloads
  page.on("request", async (request) => {
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

  const goNext = async () => {
    const navigationButton = await page.$(
      '.button-text:has-text("Begin"), .button-text:has-text("Next"), .button-text:has-text("Continue")'
    );
    if (navigationButton && (await navigationButton.isEnabled())) {
      const buttonText = await navigationButton.textContent();
      console.log(`Clicking '${buttonText}' button`);
      await Promise.all([
        navigationButton.click(),
        page.waitForURL("**", { timeout: 3000 }),
      ]);
    }
  };

  const goBack = async () => {
    console.log("Going back...");
    await page.goBack();
    await page.waitForTimeout(1000);
  };

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

  // Helper function to generate combinations of options
  function generateCombinations(array, maxSelections) {
    const results = [];

    function helper(prefix, start) {
      if (prefix.length <= maxSelections) {
        results.push(prefix);
      }
      for (let i = start; i < array.length; i++) {
        helper([...prefix, array[i]], i + 1);
      }
    }

    helper([], 0);
    return results.filter((combo) => combo.length > 0); // Exclude empty combinations
  }

  function generateCombinationsWithNone(array, noneIndex) {
    const results = [];

    function helper(prefix, start) {
      // Ensure "None of the above" cannot be combined with other options
      if (!prefix.includes(noneIndex)) {
        results.push(prefix);
      }
      for (let i = start; i < array.length; i++) {
        helper([...prefix, array[i]], i + 1);
      }
    }

    helper([], 0);

    // Add the "None of the above" option as a standalone combination
    results.push([noneIndex]);

    return results.filter((combo) => combo.length > 0); // Exclude empty combinations
  }

  function generatePairs(array) {
    const results = [];

    for (let i = 0; i < array.length; i++) {
      for (let j = i + 1; j < array.length; j++) {
        results.push([array[i], array[j]]);
      }
    }

    return results;
  }

  // Handle the concerns page
  async function handleConcerns(currentURL) {
    if (pageOptions.get(currentURL) === undefined) {
      const options = await page.$$(".option-list .option");
      const combinations = generateCombinations(
        [...Array(options.length).keys()],
        3
      ); // Generate combinations with up to 3 options
      pageOptions.set(currentURL, combinations);
    }

    if (pageOptions.get(currentURL).length > 0) {
      const options = await page.$$(".option-list .option");
      const combination = pageOptions.get(currentURL)[0];

      // Deselect all options first
      const selectedOptions = await page.$$(".option-list .option.selected");
      for (const selected of selectedOptions) {
        await selected.click();
        await page.waitForTimeout(200);
      }

      // Select the current combination of options
      console.log(`Trying combination: ${combination.map((i) => i + 1)}`);
      for (const index of combination) {
        await options[index].click();
        await page.waitForTimeout(200);
      }
    }
  }

  // Handle the prenatal page
  async function handlePrenatal(currentURL) {
    if (pageOptions.get(currentURL) === undefined) {
      const options = await page.$$(".option-list .option");
      const combinations = generatePairs([...Array(options.length).keys()]);
      pageOptions.set(currentURL, combinations);
    }

    if (pageOptions.get(currentURL).length > 0) {
      const options = await page.$$(".option-list .option");
      const combination = pageOptions.get(currentURL)[0];

      // Deselect all options first
      const selectedOptions = await page.$$(".option-list .option.selected");
      for (const selected of selectedOptions) {
        await selected.click();
        await page.waitForTimeout(200);
      }

      // Select the current combination of options
      console.log(`Trying combination: ${combination.map((i) => i + 1)}`);
      for (const index of combination) {
        await options[index].click();
        await page.waitForTimeout(200);
      }
    }
  }

  async function handleSpecialPage(currentURL) {
    const options = await page.$$(".option-list .option");
    const noneIndex = options.length - 1; // Assume the last option is "None of the above"

    if (pageOptions.get(currentURL) === undefined) {
      const combinations = generateCombinationsWithNone(
        [...Array(options.length).keys()],
        noneIndex
      );
      pageOptions.set(currentURL, combinations);
    }

    if (pageOptions.get(currentURL).length > 0) {
      const combination = pageOptions.get(currentURL)[0];

      // Deselect all options first
      const selectedOptions = await page.$$(".option-list .option.selected");
      for (const selected of selectedOptions) {
        await selected.click();
        await page.waitForTimeout(200);
      }

      // Select the current combination of options
      console.log(`Trying combination: ${combination.map((i) => i + 1)}`);
      for (const index of combination) {
        await options[index].click();
        await page.waitForTimeout(200);
      }
    }
  }

  // Handle date of birth input field
  async function handleDateOfBirth(currentURL) {
    if (pageOptions.get(currentURL) === undefined)
      pageOptions.set(currentURL, ["11/02/2004", "16/06/1979", "27/01/1955"]);
    const dateInput = await page.$('input[type="text"][name="birthdate"]');
    if (dateInput && pageOptions.get(currentURL).length > 0) {
      const dates = pageOptions.get(currentURL);
      await dateInput.fill(dates[0]);
    }
  }

  // Handle height input field
  async function handleHeight(currentURL) {
    if (pageOptions.get(currentURL) === undefined)
      pageOptions.set(currentURL, ["160", "190"]);
    const heightInput = await page.$('input[type="text"][name="question03"]');
    if (heightInput && pageOptions.get(currentURL).length > 0) {
      const heights = pageOptions.get(currentURL);
      await heightInput.fill(heights[0]);
    }
  }

  // Handle weight input field
  async function handleWeight(currentURL) {
    if (pageOptions.get(currentURL) === undefined)
      pageOptions.set(currentURL, ["50", "75", "90", "105", "120"]);
    const weightInput = await page.$('input[type="text"][name="question04"]');
    if (weightInput && pageOptions.get(currentURL).length > 0) {
      const weights = pageOptions.get(currentURL);
      await weightInput.fill(weights[0]);
    }
  }

  // Handle the email input field
  async function handleEmail(currentURL) {
    if (pageOptions.get(currentURL) === undefined)
      pageOptions.set(currentURL, ["asdf@gmail.com"]);
    const emailInput = await page.$('input[type="text"][name="question73"]');
    if (emailInput && pageOptions.get(currentURL).length > 0) {
      const emails = pageOptions.get(currentURL);
      console.log(`Entering email: ${emails[0]}`);
      await page.getByRole("textbox").click();
      await page.getByRole("textbox").fill(emails[0]);
      await page.waitForTimeout(200); // Wait for a short while after filling the email
      if (await page.getByRole("img", { name: "checkbox-empty" }).isVisible()) {
        await page.getByRole("img", { name: "checkbox-empty" }).click();
      }
      await page.waitForTimeout(200); // Wait for a short while after filling the email

      // Handle continue button after filling the email
      const continueButton = await page.$(
        '.button-text:has-text("Next"), .button-text:has-text("Continue")'
      );
      if (continueButton && (await continueButton.isEnabled())) {
        console.log(
          `Clicking 'Continue' button after entering email: ${emails[0]}`
        );
        await Promise.all([
          continueButton.click(),
          page.waitForLoadState("networkidle"), // Wait for the page to load (wait for network to be idle)
        ]);

        await page.waitForTimeout(200);
        console.log("Payload submitted and captured.");
      }
    }
  }

  // Recursive function to explore the quiz
  async function exploreQuiz() {
    const currentURL = page.url().split("/")[3];
    console.log(`Exploring path: ${currentURL}`);

    if (currentURL === "section-intro") {
      pageOptions.set(currentURL, ["null"]);
      await page.getByLabel("Accept all cookies").click();
      if (stop === 1) return;
      stop = 1;
    } else if (currentURL === "loading") {
      decisionStack.push({ questionURL: currentURL, option: "null" });
      pageOptions.set(currentURL, []);
      console.log("Waiting for the /loading page to load...");
      await page.waitForTimeout(2000); // Wait for a short while after the loading page
      console.log("Loading page loaded.");
    } else if (currentURL === "concerns") {
      await handleConcerns(currentURL);
    } else if (
      currentURL === "skin-issues" ||
      currentURL === "injuries" ||
      currentURL === "medical-condition" ||
      currentURL === "allergic" ||
      currentURL === "libido-simptoms"
    ) {
      await handleSpecialPage(currentURL);
    } else if (currentURL === "which-best-describes") {
      await handlePrenatal(currentURL);
    } else if (currentURL === "date-of-birth") {
      await handleDateOfBirth(currentURL);
    } else if (currentURL === "height") {
      await handleHeight(currentURL);
    } else if (currentURL === "weight") {
      await handleWeight(currentURL);
    } else if (currentURL === "e-mail") {
      await handleEmail(currentURL);
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
        if (pageOptions.get(currentURL) === undefined)
          pageOptions.set(currentURL, ["John Doe"]);
        // If no options, check for input fields
        const inputs = await page.$$(
          "input:visible, textarea:visible, select:visible"
        );

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
      await goBack();
    } else if (pageOptions.get(currentURL) !== undefined) {
      const options = pageOptions.get(currentURL);
      const option = options.shift();
      if (
        decisionStack.length > 0 &&
        decisionStack[decisionStack.length - 1].questionURL === currentURL
      )
        decisionStack.pop();
      decisionStack.push({ questionURL: currentURL, option });
      if (currentURL !== "e-mail") await goNext();
    }

    await exploreQuiz();
  }

  // Start the quiz traversal
  await page.goto("https://go-checkout.bioniq.com/section-intro");
  await exploreQuiz();

  console.log("All paths explored.");
  await context.close();
  await browser.close();
})();