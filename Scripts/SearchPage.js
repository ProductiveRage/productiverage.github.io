(function() {
	"use strict";

	var elementToReplaceWithResult = document.querySelector("div.Content p.NoResults");
	if (!elementToReplaceWithResult) {
		Log("SearchPage.js: Not the Search Page");
		PreLoadSearchIndex();
		return;
	}

	var objQueryString = GetQueryString();
	var strSearchTerm = objQueryString["term"];
	if (strSearchTerm) {
		strSearchTerm = ("" + objQueryString["term"]).replace(/^\s+|\s+$/g, '');
	}
	if (!strSearchTerm) {
		elementToReplaceWithResult.innerText = "No search term entered..";
		Log("SearchPage.js: No search term");
		PreLoadSearchIndex();
		return;
	}
	Log("SearchPage.js: Searching for \"" + strSearchTerm + "\"");

	var siteSearchInput = document.querySelector("div.SideBar div.Search input.SiteSearch");
	if (siteSearchInput) {
		siteSearchInput.value = strSearchTerm;
	}

	var loading = document.createElement("p");
	loading.className = "SearchResultContent";
	loading.innerText = "Searching..";
	ReplaceWith(elementToReplaceWithResult, loading);
	elementToReplaceWithResult = loading;

	(function () {
		var request = new XMLHttpRequest();
		request.open("GET", "/SearchIndex-SummaryDictionary.js", true);
		request.onload = function () {
			if (this.status >= 200 && this.status < 400) {
				Log("SearchPage.js: Loaded summary index");
				SearchIndexFor(JSON.parse(this.response), strSearchTerm);
			}
		};
		request.send();
	})();
	
	function ReplaceWith(elementToReplace, newElement) {
		elementToReplace.parentNode.insertBefore(newElement, elementToReplace);
		elementToReplace.remove();
	}

	function SearchIndexFor(objSearchIndexSummaryData) {
		var arrMatches = IndexSearchGenerator.Get(objSearchIndexSummaryData).SearchFor(strSearchTerm);
		Log("SearchPage.js: Identified " + arrMatches.length + " match" + (arrMatches.length === 1 ? "" : "es"));
		if (arrMatches.length === 0) {
			var noResults = document.createElement("p");
			noResults.className = "NoResults";
			noResults.innerText = "No results for: " + strSearchTerm;
			ReplaceWith(elementToReplaceWithResult, noResults);
			return;
		}
		LoadCompressedJsonData(
			"SearchIndex-Titles.lz.txt",
			function (objTitles) {
				Log("SearchPage.js: Loaded titles");
				for (var intIndex = 0; intIndex < arrMatches.length; intIndex++) {
					var intKey = arrMatches[intIndex].Key;
					
					var headerLink = document.createElement("a");
					headerLink.href = "/" + objTitles[intKey].Slug;
					headerLink.innerText = objTitles[intKey].Title;

					var header = document.createElement("h3");
					header.appendChild(headerLink);
					
					elementToReplaceWithResult.parentNode.insertBefore(header, elementToReplaceWithResult);
					
					var summary = document.createElement("p");
					summary.className = "SearchResultContent";
					summary.innerText = "Retrieving content..";
					summary.style.opacity = "0.2";
					LoadSummaryContentFor(summary, intKey);
					
					elementToReplaceWithResult.parentNode.insertBefore(header, elementToReplaceWithResult);
					elementToReplaceWithResult.parentNode.insertBefore(summary, elementToReplaceWithResult);
				}
				elementToReplaceWithResult.remove();
			}
		);
	}

	function LoadSummaryContentFor(summary, intKey) {
		LoadCompressedJsonData(
			"SearchIndex-" + intKey + "-CompleteDictionary.lz.txt",
			function (objSearchIndexDetailDataForPost) { // TODO: Handle failure
				Log("SearchPage.js: Loaded source location data for Post " + intKey);
				LoadCompressedData(
					"SearchIndex-Content-" + intKey + ".lz.txt",
					function (strPlainTextContent) { // TODO: Handle failure
						Log("SearchPage.js: Loaded plain-text content for Post " + intKey);
						var strHtmlContent;
						if (!strPlainTextContent) {
							strHtmlContent = "Unable to load content";
						}
						else {
							var arrMatches = IndexSearchGenerator.Get(objSearchIndexDetailDataForPost).SearchFor(strSearchTerm);
							if (arrMatches.length < 0) {
								strHtmlContent = "Unable to load content";
							}
							else {
								// There should be precisely one match since each detail file is for a single Post and we know that it
								// matches this Post (according to the summary file, at least) and there shouldn't be multiple entries
								// for the same Post.
								strHtmlContent = GetHighlightedPostSummary(
									strPlainTextContent,
									arrMatches[0].SourceLocations
								);
							}
						}
						summary.innerHTML = strHtmlContent;
						summary.style.transition = "opacity 1s";
						summary.style.opacity = "1";
					}
				);
			}
		);

		function GetHighlightedPostSummary(strPlainTextContent, arrSourceLocationsForPost) {
			// All of the source locations that are extracted from Description content (as opposed to Title or
			// Tags) will have a SourceFieldIndex of zero due to the way in which the index data is generated
			var arrSourceLocationsForFieldZero = [];
			for (var intIndex = 0; intIndex < arrSourceLocationsForPost.length; intIndex++) {
				if (arrSourceLocationsForPost[intIndex].SourceFieldIndex === 0) {
					arrSourceLocationsForFieldZero.push(arrSourceLocationsForPost[intIndex]);
				}
			}
			return SearchTermHighlighter.GetPlainTextContentAsHighlightedHtml(
				strPlainTextContent,
				350,
				arrSourceLocationsForFieldZero
			);
		}
	}

	function GetQueryString() {
		var objQueryString = {};
		var arrEntries = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
		for(var intIndex = 0; intIndex < arrEntries.length; intIndex++) {
			var strEntry = arrEntries[intIndex];
			var strName, strValue;
			var intBreakPoint = strEntry.indexOf("=");
			if (intBreakPoint === -1) {
				strName = strEntry;
				strValue = null;
			}
			else {
				strName = strEntry.substr(0, intBreakPoint);
				strValue = strEntry.substr(intBreakPoint + 1);
			}
			if (typeof(objQueryString[strName]) === "undefined") {
				objQueryString[strName] = safelyEscapeQueryStringValue(strValue);
			}
			else {
				objQueryString[strName] += "," + safelyEscapeQueryStringValue(strValue);
			}
		}
		return objQueryString;

		function safelyEscapeQueryStringValue(strValue) {
			if (!strValue) {
				return strValue;
			}
			// decodeURIComponent will replace "%20" with a " " but if a "+" symbol has got in there (like from a form field
			// including a space) then it won't be translated back into a space. A QueryString whose content should contain
			// a "+" should have it encoded as "%2B" so making this replacement before calling decodeURIComponent should
			// mean we're golden.
			strValue = strValue.replace(/\+/g, " ");
			try { return decodeURIComponent(strValue); }
			catch(e) { }
			return strValue;
		}
	}

	function PreLoadSearchIndex() {
		var request = new XMLHttpRequest();
		request.open("GET", "/SearchIndex-SummaryDictionary.js", true);
		request.send();
	}

	function LoadCompressedJsonData(strUrl, fncSuccess, fncFailure) {
		LoadCompressedData(
			strUrl,
			function(strContent) {
				var objData;
				try {
					eval("objData = " + strContent);
				}
				catch(e) {
					if (fncFailure) {
						fncFailure(e);
					}
					return;
				}
				fncSuccess(objData);
			},
			function() {
				if (fncFailure) {
					fncFailure(arguments);
				}
			}
		);
	}

	function LoadCompressedData(strUrl, fncSuccess, fncFailure) {
		// Note: I've seen this fail when requesting files with extension ".js" but work when the exact same file is
		// renamed to ".txt", I'm not sure if this is in IIS that it's failing or if jQuery is requesting the data
		// in a slightly different manner (despite the explicit dataType option), so best just ensuring that all
		// LZ-compressed data is stored in a file with a ".txt" extension.
		var request = new XMLHttpRequest();
		request.open("GET", strUrl, true);
		request.onload = function () {
			if (this.status >= 200 && this.status < 400) {
				var strContent;
				try {
					strContent = LZString.DecompressFromUTF16(this.response);
				}
				catch(e) {
					if (fncFailure) {
						fncFailure(e);
					}
					return;
				}
				fncSuccess(strContent);
			}
		};
		request.send();
	}

	function Log(strContent) {
		try { console.log(strContent); }
		catch(e) { }
	}

})();