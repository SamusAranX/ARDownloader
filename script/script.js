"use strict";

function debugList(arr) {
	for (let i = 0; i < arr.length; i++) {
		console.debug(arr[i]);
	}
}

/** Example: Returns "https://www.apple.com/" for a site URL of https://www.apple.com/de/iphone-15-pro/?queries=and#hashes */
function getPageOrigin() {
	return (new URL(window.location.href)).origin;
}

/** Example: Returns "iphone-15-pro" for a site URL of https://www.apple.com/de/iphone-15-pro/?queries=and#hashes */
function getPagePath() {
	let pathParts = (new URL(window.location.href)).pathname.split("/");
	return pathParts.pop() || pathParts.pop();
}

function getModelsFromOptionMap(dict, level=0) {
	// console.debug(`recursive: ${level}`, dict);
	const needleElements = ["model", "acaClick", "acaTitle", "ariaLabel"];

	// no infinite recursion here
	if (level > 3) {
		console.debug("recursiveObjFunc bailing");
		return models;
	}

	let models = [];
	for (const [key, value] of Object.entries(dict)) {
		if (Object.keys(value).some(k => needleElements.includes(k))) {
			// found what we're looking for
			models.push(value["model"]);
		} else {
			// keep going deeper
			let moreModels = getModelsFromOptionMap(value, ++level);
			models.push(...moreModels);
		}
	}

	return models;
};

function parseURLOptionMap(dataset) {
	let optionMap = JSON.parse(dataset.urlOptionMap);
	let models = getModelsFromOptionMap(optionMap);

	return models;
}

function getAppleARLinks() {
	// step 1: finding all <a> elements with rel=ar set
	console.debug("Step 1: a[rel=ar]");

	const pageOrigin = getPageOrigin();
	const dataUrlAttributes = ["urlRoot", "urlProduct", "urlOptionMap"];
	let arURLs = Array.from(document.querySelectorAll("a[rel=ar]")).flatMap(e => {
		// console.debug(e, e.dataset);

		const urlRoot = e.dataset["urlRoot"];
		const urlProduct = e.dataset["urlProduct"];
		if (dataUrlAttributes.every((attr) => (attr in e.dataset))) {
			let urls = [];
			try {
				// make urls absolute using urlRoot and urlProduct
				let newURLs = parseURLOptionMap(e.dataset).map(u => {
					return (new URL(`${urlRoot}/${urlProduct}/${u}`, pageOrigin)).toString();
				});

				urls = urls.concat(newURLs);
			} catch(err) {
				console.error(err);
				throw err;
			}

			return urls;
		} else {
			let value = e.href; // expected to be absolute link
			if (value)
				return value;
		}
	});

	console.debug("AR URLs:", arURLs);

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
			let optionMap = JSON.parse(valueJSON);
			for (let deviceKey in optionMap) {
				let deviceObj = optionMap[deviceKey];
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
	let urlOrigin = getPageOrigin();
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
	console.debug("absolute URLs:", absURLs);
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