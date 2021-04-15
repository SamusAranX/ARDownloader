chrome.webNavigation.onCompleted.addListener(details => {
	if (!/^https:\/\/(?:.+\.)?apple\.com\/?.*?$/gmi.test(details.url))
		return;

	try {
		let activeTab = details.tabId;
		chrome.scripting.executeScript({
			files: ["script/script.js"],
			target: { tabId: activeTab }
		}, function (injectionResults) {
			if (!injectionResults) {
				return;
			}

			let result = injectionResults[0];
			let numURLs = result.result.urls.length;

			if (numURLs == 0)
				return;

			chrome.action.setBadgeText({
				"tabId": activeTab,
				"text": numURLs.toString()
			});
		});
	} catch (exc) {
		console.error(exc)
	}
});