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

function generateCombinationsWithEmpty(array, maxSelections) {
  const results = [];
  function helper(prefix, start) {
    if (prefix.length <= maxSelections && prefix.length > 0) {
      results.push(prefix);
    }
    for (let i = start; i < array.length; i++) {
      helper([...prefix, array[i]], i + 1);
    }
  }
  helper([], 0);
  results.push([]); // Add the empty selection at the end
  return results;
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

  for (let i = 0; i < array.length; i++) {
    results.push([array[i]]);
  }

  return results;
}

// Handle the concerns page
async function handleConcerns(currentURL, page, pageOptions) {
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
      await page.waitForTimeout(100);
    }

    // Select the current combination of options
    console.log(`Trying combination: ${combination.map((i) => i + 1)}`);
    for (const index of combination) {
      await options[index].click();
      await page.waitForTimeout(100);
    }
  }
}

// Handle the prenatal page
async function handlePrenatal(currentURL, page, pageOptions) {
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
      await page.waitForTimeout(100);
    }

    // Select the current combination of options
    console.log(`Trying combination: ${combination.map((i) => i + 1)}`);
    for (const index of combination) {
      await options[index].click();
      await page.waitForTimeout(100);
    }
  }
}

async function handleSpecialPage(currentURL, page, pageOptions) {
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
      await page.waitForTimeout(100);
    }

    // Select the current combination of options
    console.log(`Trying combination: ${combination.map((i) => i + 1)}`);
    for (const index of combination) {
      await options[index].click();
      await page.waitForTimeout(100);
    }
  }
}

// Handle date of birth input field
async function handleDateOfBirth(currentURL, page, pageOptions) {
  if (pageOptions.get(currentURL) === undefined)
    pageOptions.set(currentURL, ["11/02/2004", "16/06/1979", "27/01/1955"]);
  const dateInput = await page.$('input[type="text"][name="birthdate"]');
  if (dateInput && pageOptions.get(currentURL).length > 0) {
    const dates = pageOptions.get(currentURL);
    await dateInput.fill(dates[0]);
    await page.waitForTimeout(100);
  }
}

// Handle height input field
async function handleHeight(currentURL, page, pageOptions) {
  if (pageOptions.get(currentURL) === undefined)
    pageOptions.set(currentURL, ["160", "190"]);
  const heightInput = await page.$('input[type="text"][name="question03"]');
  if (heightInput && pageOptions.get(currentURL).length > 0) {
    const heights = pageOptions.get(currentURL);
    await heightInput.fill(heights[0]);
    await page.waitForTimeout(100);
  }
}

// Handle weight input field
async function handleWeight(currentURL, page, pageOptions) {
  if (pageOptions.get(currentURL) === undefined)
    pageOptions.set(currentURL, ["50", "75", "90", "110"]);
  const weightInput = await page.$('input[type="text"][name="question04"]');
  if (weightInput && pageOptions.get(currentURL).length > 0) {
    const weights = pageOptions.get(currentURL);
    await weightInput.fill(weights[0]);
    await page.waitForTimeout(100);
  }
}

// Handle pregnancy weeks page
async function handlePregnancyWeeks(currentURL, page, pageOptions) {
  if (!pageOptions.get(currentURL)) {
    const pregnancyWeeks = [8, 16, 24, 32, 40];
    pageOptions.set(currentURL, pregnancyWeeks);
  }

  const weeksOptions = pageOptions.get(currentURL);

  if (weeksOptions.length > 0) {
    // Select the first value in the list
    const selectedWeek = weeksOptions[0];
    console.log(`Entering pregnancy week: ${selectedWeek}`);

    // Locate the input field and fill it with the selected week
    const weekInput = await page.$('input[type="text"][name="question09"]');
    if (weekInput) {
      await weekInput.fill(String(selectedWeek)); // Fill the input as a string
      await page.waitForTimeout(100); // Short delay for UI update
    }
  }
}

// Handle the what meds page
async function handleWhatMedsPage(currentURL, page, pageOptions) {
  // Define the available medication options
  const medications = ["ATORVASTATIN", "WARFARIN", "ACCURETIC"];

  if (pageOptions.get(currentURL) === undefined) {
    const combinations = generateCombinationsWithEmpty(medications, 3);
    pageOptions.set(currentURL, combinations);
  }

  const selectedCombinations = pageOptions.get(currentURL);

  if (selectedCombinations.length > 0) {
    // Select the first combination from the list
    const combination = selectedCombinations[0];
    console.log(`Selecting combination: ${combination.join(", ")}`);

    // Clear previously selected options
    const selectedOptions = await page.$$(
      ".pred-selected-container .close-icon"
    );
    for (const closeButton of selectedOptions) {
      await closeButton.click();
      await page.waitForTimeout(100); // Wait for the UI to update
    }

    // Select options in the current combination
    for (const medication of combination) {
      await page.getByRole("textbox").click();
      await page.getByRole("textbox").fill(medication);
      console.log(`Typing and selecting: ${medication}`);
      await page.getByText(medication, { exact: true }).click();
      await page.waitForTimeout(100); // Wait for the UI to update
    }
  }
}

// Handle the email input field
async function handleEmail(currentURL, page, pageOptions) {
  if (pageOptions.get(currentURL) === undefined)
    pageOptions.set(currentURL, ["asdf@gmail.com"]);
  const emailInput = await page.$('input[type="text"][name="question73"]');
  if (emailInput && pageOptions.get(currentURL).length > 0) {
    const emails = pageOptions.get(currentURL);
    console.log(`Entering email: ${emails[0]}`);
    await emailInput.fill(emails[0]);
    // await page.waitForTimeout(100); // Wait for a short while after filling the email
    if (await page.getByRole("img", { name: "checkbox-empty" }).isVisible()) {
      await page.getByRole("img", { name: "checkbox-empty" }).click();
    }
    await page.waitForTimeout(100); // Wait for a short while after filling the email

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

      await page.waitForTimeout(100);
      console.log("Payload submitted and captured.");
    }
  }
}

module.exports = {
  handleConcerns,
  handlePrenatal,
  handleSpecialPage,
  handleDateOfBirth,
  handleHeight,
  handleWeight,
  handlePregnancyWeeks,
  handleWhatMedsPage,
  handleEmail,
};
