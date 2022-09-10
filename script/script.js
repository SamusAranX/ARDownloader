(function () {
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
		let arURLs = [];

		// step 1: finding all <a> elements with rel=ar set
		console.debug("Step 1: a[rel=ar]");
		arURLs = Array.from(document.querySelectorAll("a[rel=ar]")).map(e => {
			let value = e.href; // expected to be absolute link
			if (value)
				return value;

			return null;
		});

		let usdzPrefix = "";
		if (arURLs) {
			let tempURL = arURLs[0];
			let tempFilename = tempURL.split("/").pop();
			usdzPrefix = tempURL.substring(0, tempURL.length - tempFilename.length);
		}
		console.debug("usdz prefix:", usdzPrefix);

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

		if (!arURLs) {
			// step 3 (ONLY if no files have been found): apply regex to body.innerHTML
			console.debug("Step 3: regex");

			let arFallbackRegex = /\"([a-z0-9\/\-_\.]+?\.(?:usdz|reality))\"/gmi;
			let allMatches = [...document.body.innerHTML.matchAll(arFallbackRegex)].map(m => m[1]);

			arURLs = arURLs.concat(allMatches);
		}

		// cleanup: make every relative URL absolute
		let absURLs = [];
		for (let i = 0; i < arURLs.length; i++) {
			let url = arURLs[i];
			if (url.startsWith("http")) {
				absURLs.push(url);
				continue; // url is already absolute
			}

			let newURL = new URL(url, usdzPrefix);
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
})();