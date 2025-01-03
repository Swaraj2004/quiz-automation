const goNext = async (page) => {
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

const goBack = async (page) => {
  console.log("Going back...");
  await page.goBack();
  await page.waitForTimeout(200);
};

module.exports = { goNext, goBack };
