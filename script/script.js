"use strict";

function debugList(arr) {
	for (let i = 0; i < arr.length; i++) {
		console.debug(arr[i]);
	}
}

function getPagePath() {
	let parts = window.location.href.split('/');
	let lastPart = parts.pop() || parts.pop();
	return lastPart.split('#')[0].split('?')[0];
}

function getAppleARLinks() {
	let urlOrigin = (new URL(window.location.href)).origin;
	console.debug("site host:", urlOrigin);

	// step 1: finding all <a> elements with rel=ar set
	console.debug("Step 1: a[rel=ar]");
	let dataUrlAttributes = ["urlRoot", "urlProduct", "urlOptionMap"];
	let arURLs = Array.from(document.querySelectorAll("a[rel=ar]")).flatMap(e => {
		if (dataUrlAttributes.every((attr) => (attr in e.dataset))) {
			console.debug("New AR system (2023) detected");

			let urls = [];
			try {
				let topObj = JSON.parse(e.dataset.urlOptionMap);
				for (const colorKey of Object.keys(topObj.color)) {
					let color = topObj.color[colorKey];
					for (const sizeKey of Object.keys(topObj.size)) {
						let size = topObj.size[sizeKey];
						urls.push(`${urlOrigin}${e.dataset.urlRoot}/${e.dataset.urlProduct}/${size}_${color}.usdz`);
					}
				}
			} catch(err) {
				console.error(err);
			}

			return urls;
		} else {
			let value = e.href; // expected to be absolute link
			if (value)
				return value;
		}

		return null;
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
	return {
		urls: getAppleARLinks(),
		path: getPagePath()
	};
}

returnValue();