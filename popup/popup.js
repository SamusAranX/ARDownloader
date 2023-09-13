/* globals chrome */
"use strict";

var downloadPath = "";

var divMessage, paraMessage, divInfo, spanURLNumber, selURLsList;
var btnCopySel, btnCopyAll, btnDownloadSel, btnDownloadAll;

const MIN_LIST_SIZE = 1;
const MAX_LIST_SIZE = 15;

function copySelectedURLs(e) {
	let str = Array.from(selURLsList.selectedOptions).map(o => o.value).join("\n");
	navigator.clipboard.writeText(str);
}

function copyAllURLs(e) {
	let str = Array.from(selURLsList.options).map(o => o.value).join("\n");
	navigator.clipboard.writeText(str);
}

function downloadFromOptionList(optionElements) {
	let downloadOptions = Array.from(optionElements).map(o => {
		let filename = o.dataset.filename;
		let url = o.value;

		return {
			conflictAction: "overwrite",
			filename: `${downloadPath}/${filename}`,
			url: url
		};
	});

	for (var i = 0; i < downloadOptions.length; i++) {
		chrome.downloads.download(downloadOptions[i]);
	}
}

function downloadSelectedFiles(e) {
	downloadFromOptionList(selURLsList.selectedOptions);
}

function downloadAllFiles(e) {
	downloadFromOptionList(selURLsList.options);
}

function prepareUI(manifest) {
	document.title = manifest.name;
	document.getElementById("ext-name").innerHTML = manifest.name;
	document.getElementById("ext-version").innerHTML = `v${manifest.version}`;

	divMessage       = document.querySelector("div.container.message");
	paraMessage      = document.querySelector("#message");
	divInfo          = document.querySelector("div.info");
	spanURLNumber    = divInfo.querySelector("p.num-urls span");
	selURLsList      = document.querySelector("#url-list");

	btnCopySel     = document.querySelector("#btn-copy-sel");
	btnCopyAll     = document.querySelector("#btn-copy-all");
	btnDownloadSel = document.querySelector("#btn-download-sel");
	btnDownloadAll = document.querySelector("#btn-download-all");

	btnCopySel.addEventListener("click", copySelectedURLs);
	btnCopyAll.addEventListener("click", copyAllURLs);
	btnDownloadSel.addEventListener("click", downloadSelectedFiles);
	btnDownloadAll.addEventListener("click", downloadAllFiles);
}

function deadEnd() {
	btnCopySel.disabled = true;
	btnCopyAll.disabled = true;
	btnDownloadSel.disabled = true;
	btnDownloadAll.disabled = true;

	document.body.classList.add("dead-end");
}

function handleUnsupportedSite() {
	deadEnd();

	paraMessage.innerHTML = "This extension only works on Apple product pages.";
	document.body.classList.add("warning");
}

function handleError(err) {
	deadEnd();

	if (err) {
		paraMessage.innerHTML = err;
	} else {
		paraMessage.innerHTML = "Something went wrong.";
	}

	divMessage.classList.add("error");
}

function getFilenameFromURL(url) {
	return url.split("#")[0].split("/").pop().split("?")[0];
}

function createElement(tag, content) {
	let el = document.createElement(tag);

	if (content)
		el.innerHTML = content;

	return el;
}

function displayURLs(urls) {
	let numURLs = urls.length;
	if (numURLs === 0) {
		spanURLNumber.innerHTML = `<b>No</b> files found.`;
		document.body.classList.add("empty");
		return;
	}

	let fileWord = numURLs === 1 ? "file" : "files";
	spanURLNumber.innerHTML = `<b>${numURLs}</b> ${fileWord} found.`;
	selURLsList.size = Math.min(MAX_LIST_SIZE, Math.max(MIN_LIST_SIZE, numURLs));

	let addPreviousPart = false;

	let deduplicatedFilenames = [...new Set(urls.map(getFilenameFromURL))];
	if (deduplicatedFilenames.length !== urls.length) {
		console.debug("Found duplicate filenames. addPreviousPart = true");
		divInfo.appendChild(createElement("p", "Filenames have been altered to avoid filename collisions."));
		addPreviousPart = true;
	}

	let detectedFiveG = false;

	urls.forEach(url => {
		let filename;
		if (addPreviousPart) {
			let urlParts = url.split("/");
			let lastPart = urlParts.pop() || urlParts.pop();
			let secondToLastPart = urlParts.pop();
			filename = secondToLastPart + "-" + getFilenameFromURL(lastPart);
		} else {
			filename = getFilenameFromURL(url);
		}

		if (!detectedFiveG && /5g/i.test(url)) {
			detectedFiveG = true;
			divInfo.appendChild(createElement("p", "<b>Note:</b> Some or all of these URLs are for US-only 5G models. Visit a non-US version of this product page to look for more files."));
		}

		let option = createElement("option", filename);
		option.dataset.filename = filename;
		option.value = url;

		selURLsList.add(option);
	});
}

window.onload = function() {
	let manifest = chrome.runtime.getManifest();
	prepareUI(manifest);

	try {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			let activeTab = tabs[0];
			if (!activeTab.url) {
				handleUnsupportedSite();
				return;
			}

			chrome.scripting
				.executeScript({
					target: { tabId: activeTab.id },
					files: ["script/script.js"],
				})
				.then(injectionResults => {
					if (!injectionResults) {
						handleError("Couldn't communicate with extension.");
						return;
					}

					let result = injectionResults[0];
					if (result.result.error) {
						handleError(result.result.error);
						return;
					}

					downloadPath = result.result.path;
					displayURLs(result.result.urls);
				},
				error => {
					handleError(error);
				});
		});
	} catch (exc) {
		handleError(exc.message);
	}
};