var downloadPath = "";

var paraErrorMessage, spanURLNumber, paraLegend, selURLsList;
var btnCopySel, btnCopyAll, btnDownloadSel, btnDownloadAll;

const MIN_LIST_SIZE = 1;
const MAX_LIST_SIZE = 15;

function prepareUI() {
	let manifest = chrome.runtime.getManifest();
	document.title = manifest.name;
	document.getElementById("ext-name").innerHTML = manifest.name;
	document.getElementById("ext-version").innerHTML = `v${manifest.version}`;

	paraErrorMessage = document.querySelector("#error-message");
	spanURLNumber    = document.querySelector("p.info.num-urls span");
	paraLegend       = document.querySelector("p.info.legend");
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

window.onload = function() {
	prepareUI();

	try {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			let activeTab = tabs[0].id;
			chrome.scripting.executeScript({
				files: ["script/script.js"],
				target: { tabId: activeTab }
			}, function (injectionResults) {
				if (!injectionResults) {
					handleError();
					return;
				}

				let result = injectionResults[0];

				downloadPath = result.result.path;
				displayURLs(result.result.urls);
			});
		});
	} catch (exc) {
		handleError(exc.message);
	}
};

function handleError(err) {
	btnCopySel.disabled = true;
	btnCopyAll.disabled = true;
	btnDownloadSel.disabled = true;
	btnDownloadAll.disabled = true;

	console.debug(chrome.runtime.lastError);

	if (err)
		paraErrorMessage.innerHTML = err;
	else
		paraErrorMessage.innerHTML = chrome.runtime.lastError.message;

	document.body.classList.add("error");
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

	let fileWord = numURLs == 1 ? "file" : "files";
	spanURLNumber.innerHTML = `<b>${numURLs}</b> ${fileWord} found.`;

	if (numURLs == 0) {
		document.body.classList.add("empty");
		return;
	}

	selURLsList.size = Math.min(MAX_LIST_SIZE, Math.max(MIN_LIST_SIZE, numURLs));

	let addPreviousPart = false;

	let deduplicatedFilenames = [...new Set(urls.map(getFilenameFromURL))];
	if (deduplicatedFilenames.length != urls.length) {
		console.debug("Found duplicate filenames. addPreviousPart = true");
		paraLegend.appendChild(createElement("br"));
		paraLegend.appendChild(createElement("span", "Filenames have been altered to avoid filename collisions."));
		addPreviousPart = true;
	}

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

		let option = createElement("option", filename);
		option.dataset.filename = filename;
		option.value = url;

		selURLsList.add(option);
	});
}

function copySelectedURLs(e) {
	let str = Array.from(selURLsList.selectedOptions).map(o => o.value).join("\n")
	navigator.clipboard.writeText(str);
}

function copyAllURLs(e) {
	let str = Array.from(selURLsList.options).map(o => o.value).join("\n")
	navigator.clipboard.writeText(str);
}

function downloadSelectedFiles(e) {
	downloadFromOptionList(selURLsList.selectedOptions);
}

function downloadAllFiles(e) {
	downloadFromOptionList(selURLsList.options);
}

function downloadFromOptionList(optionElements) {
	let downloadOptions = Array.from(optionElements).map(o => {
		let filename = o.dataset.filename;
		let url = o.value;

		return {
			conflictAction: "overwrite",
			filename: `${downloadPath}/${filename}`,
			url: url
		}
	});

	for (var i = 0; i < downloadOptions.length; i++) {
		chrome.downloads.download(downloadOptions[i]);
	}
}