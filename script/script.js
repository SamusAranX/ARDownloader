"use strict";

function debugList(arr) {
	for (let i = 0; i < arr.length; i++) {
		console.debug(arr[i]);
	}
}

/** Example: Returns "iphone-15-pro" for a site URL of https://www.apple.com/de/iphone-15-pro/?queries=and#hashes */
function getPagePath() {
	let pathParts = (new URL(window.location.href)).pathname.split("/");
	return pathParts.pop() || pathParts.pop();
}

function hasAllAttributes(attrs, obj) {
	return attrs.every((attr) => (attr in obj));
}

// the 2023 url option map has "color" and "size" keys. check whether they exist and if so, assemble urls
function urlOptionMap2023(dataset, urlOrigin) {
	try {
		let urls = [];
		let optionMap = JSON.parse(dataset.urlOptionMap);
		console.debug(optionMap);
		for (const colorKey of Object.keys(optionMap.color)) {
			let color = optionMap.color[colorKey];
			for (const sizeKey of Object.keys(optionMap.size)) {
				let size = optionMap.size[sizeKey];
				urls.push(`${urlOrigin}${dataset.urlRoot}/${dataset.urlProduct}/${size}_${color}.usdz`);
			}
		}
		return urls;
	} catch(err) {
		throw new Error(`Couldn't parse 2023 AR structure.\n${err}`);
	}
}

// the 2024 url option map needs to be parsed recursively.
// at the lowest level there should be an object with a "model" key that contains the last part of the usdz url.
function urlOptionMap2024(dataset, urlOrigin) {
	let recursiveModelSearch = function(urls, branch, depth=0) {
		if (depth > 4) {
			throw new Error("gone off the deep end");
		}

		for (const key of Object.keys(branch)) {
			if (key == "model") {
				urls.push(branch[key]);
				return;
			} else {
				recursiveModelSearch(urls, branch[key], depth+1);
			}
		}
	}

	let optionMap = JSON.parse(dataset.urlOptionMap);

	console.debug(dataset);
	console.debug(optionMap);

	try {
		let urls = [];
		recursiveModelSearch(urls, optionMap);
		return urls.map(u => {
			return `${urlOrigin}${dataset.urlRoot}/${dataset.urlProduct}/${u}`;
		});
	} catch(err) {
		throw new Error(`Couldn't parse 2024 AR structure: ${err}`);
	}
}

function getAppleARLinks() {
	let urlOrigin = (new URL(window.location.href)).origin;
	console.debug("url origin:", urlOrigin);

	// step 1: finding all <a> elements with rel=ar set
	console.debug("Step 1: a[rel=ar]");
	let dataUrlAttributes = ["urlRoot", "urlProduct", "urlOptionMap"];

	let arURLs = Array.from(document.querySelectorAll("a[rel=ar]")).flatMap(e => {
		if (hasAllAttributes(dataUrlAttributes, e.dataset)) {
			try {
				if (hasAllAttributes(["color", "size"], JSON.parse(e.dataset.urlOptionMap))) {
					console.info("url option map matches 2023 version");
					return urlOptionMap2023(e.dataset, urlOrigin);
				}

				let urls = urlOptionMap2024(e.dataset, urlOrigin);
				if (urls) {
					console.info("url option map matches 2024 version");
					return urls;
				}

				// this can only be reached if none of the preceding methods succeeded
				console.error("Unknown URL Option Map version!", JSON.parse(e.dataset.urlOptionMap));
			} catch(err) {
				console.error("Unknown URL Option Map version!", err);
			}

			return urls;
		} else {
			let value = e.href; // expected to be absolute link
			if (value)
				return value;
		}
	});

	// step 2: finding other elements that might hold URLs to AR files
	console.debug("Step 2: attributes");
	let arAttributes = [
		"data-quicklook-url",
		"data-quicklook-classic-url",
		"data-quicklook-modern-url",
		"data-quicklook-classic-url-pro-max",
		"data-quicklook-modern-url-pro-max",
		"data-quicklook-classic-url-mini",
		"data-quicklook-modern-url-mini",
		"data-quicklook-udz",
		"data-quicklook-udz-promax",
		"data-quicklook-udz-mini",
		"data-ar-quicklook-usdz"
	];
	let arQuerySelectors = arAttributes.map(s => `[${s}]`).join(",");
	let arRelatedElements = document.querySelectorAll(arQuerySelectors);

	for (let i = 0; i < arRelatedElements.length; i++) {
		let e = arRelatedElements[i];

		for (let j = 0; j < arAttributes.length; j++) {
			let attr = arAttributes[j];
			let value = e.getAttribute(attr);
			if (value)
				arURLs.push(value);
		}
	}

	// step 2.5: the data-ar-quicklook-attribs-by-model attribute might contain JSON containing more filenames
	console.debug("Step 2.5: more attributes");
	let arAttribsElements = document.querySelectorAll("[data-ar-quicklook-attribs-by-model]");
	for (let i = 0; i < arAttribsElements.length; i++) {
		let e = arAttribsElements[i];
		let valueJSON = e.getAttribute("data-ar-quicklook-attribs-by-model");
		if (!valueJSON)
			continue;

		console.debug(valueJSON);

		try {
			let topObj = JSON.parse(valueJSON);
			for (let deviceKey in topObj) {
				let deviceObj = topObj[deviceKey];
				if (!deviceObj.hasOwnProperty("data-ar-quicklook-usdz"))
					continue;

				arURLs.push(deviceObj["data-ar-quicklook-usdz"]);
			}
		} catch(err) {
			console.error(err);
			throw new Error("Couldn't parse data-ar-quicklook-attribs-by-model structure.");
		}
	}

	// step 3 (ONLY if no files have been found): apply regex to body.innerHTML
	if (arURLs.length === 0) {
		console.debug("Step 3: regex");

		let arFallbackRegex = /\"([a-z0-9\/\-_\.]+?\.(?:usdz|reality))\"/gmi;
		let allMatches = [...document.body.innerHTML.matchAll(arFallbackRegex)].map(m => m[1]);

		arURLs = arURLs.concat(allMatches);
	}

	// cleanup: make every relative URL absolute
	let absURLs = [];
	for (const url of arURLs) {
		if (url == null)
			continue;

		if (url.startsWith("http")) {
			absURLs.push(url);
			continue; // url is already absolute
		}

		let newURL = new URL(url, urlOrigin);
		absURLs.push(newURL.href);
	}

	absURLs = [...new Set(absURLs)].sort();
	debugList(absURLs);
	return absURLs;
}

function returnValue() {
	let links = null;
	let error = null;

	try {
		links = getAppleARLinks();
	} catch(err) {
		error = err;
	}

	return {
		urls: links,
		error: error,
		path: getPagePath()
	};
}

returnValue();