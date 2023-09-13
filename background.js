/* globals chrome */
"use strict";

function setBadgeText(tabId, text) {
	chrome.action.setBadgeText({
		"tabId": tabId,
		"text": text
	});
}

chrome.webNavigation.onCompleted.addListener(details => {
	if (!/^(?:https:\/\/web\.archive\.org\/web\/\d+\/)?https:\/\/(?:www\.)?apple.com(?:\.cn)?(?:\/.*?)?$/gmi.test(details.url)) {
		return;
	}

	let activeTab = details.tabId;
	try {
		chrome.scripting
			.executeScript({
				target: { tabId: activeTab },
				files: ["script/script.js"],
			})
			.then(injectionResults => {
				if (!injectionResults) {
					return;
				}

				let result = injectionResults[0];
				if (result.result.error) {
					setBadgeText(activeTab, "!");
					return;
				}

				let numURLs = result.result.urls.length;
				setBadgeText(activeTab, numURLs.toString());
			},
			error => {
				console.error(error);
				setBadgeText(activeTab, "!");
			});
	} catch (exc) {
		console.error(exc);
		setBadgeText(activeTab, "!");
	}
});