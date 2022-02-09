var SearchTermHighlighter = (function() {
	function IdentifySearchTermsToHighlight(strContent, intMaxLengthForHighlightedContent, arrSourceLocations) {	
		// If there are no source locations there there is nothing to highlight
		if (!strContent || !arrSourceLocations || (arrSourceLocations.length === 0)) {
			return [];
		}

		// Ensure that all source locations are from the same field
		if (arrSourceLocations.length > 1) {
			for (var intIndexSourceLocation = 1; intIndexSourceLocation < arrSourceLocations.length; intIndexSourceLocation++) {
				if (arrSourceLocations[intIndexSourceLocation].SourceFieldIndex !== arrSourceLocations[0].SourceFieldIndex) {
					throw new Error("SearchTermHighlighter.IdentifySearchTermsToHighlight: All sourceLocations must have the same SourceFieldIndex");
				}
			}
		}

		// Sort sourceLocations by index and then length
		arrSourceLocations = arrSourceLocations.slice(0); // Clone array so that sorting doesn't alter caller's data
		arrSourceLocations.sort(function(x, y) {
			if (x.SourceIndex < y.SourceIndex)
				return -1;
			else if (y.SourceIndex < x.SourceIndex)
				return 1;

			if (x.SourceTokenLength < y.SourceTokenLength)
				return -1;
			else if (y.SourceTokenLength < x.SourceTokenLength)
				return 1;

			return 0;
		});
		
		// Identify all combinations of source locations that can be shown at once without exceeding the maxLengthForHighlightedContent restraint
		var arrSourceLocationChains = [];
		for (var intIndexOfFirstSourceLocationInChain = 0; intIndexOfFirstSourceLocationInChain < arrSourceLocations.length; intIndexOfFirstSourceLocationInChain++) {
			var arrSourceLocationChain = [];
			for (var intIndexOfLastSourceLocationInChain = intIndexOfFirstSourceLocationInChain; intIndexOfLastSourceLocationInChain < arrSourceLocations.length; intIndexOfLastSourceLocationInChain++) {
				var intStartPoint = arrSourceLocations[intIndexOfFirstSourceLocationInChain].SourceIndex;
				var intEndPoint = arrSourceLocations[intIndexOfLastSourceLocationInChain].SourceIndex + arrSourceLocations[intIndexOfLastSourceLocationInChain].SourceTokenLength;
				if ((intEndPoint - intStartPoint) > intMaxLengthForHighlightedContent) {
					break;
				}

				arrSourceLocationChain.push(arrSourceLocations[intIndexOfLastSourceLocationInChain]);
				arrSourceLocationChains.push(arrSourceLocationChain.slice(0));
			}
		}

		// Get the best source location chain, if any (if not, return an empty set) and translate into a StringSegment set
		if (arrSourceLocationChains.length === 0) {
			return [];
		}
		arrSourceLocationChains.sort(SearchTermBestMatchComparer);
		return ToStringSegments(
			arrSourceLocationChains[0]
		);
	}

	function ToStringSegments(arrSourceLocations) {
		arrSourceLocations = arrSourceLocations.slice(0); // Clone before sorting to prevent affecting the caller's data when sorting
		arrSourceLocations.sort(function(x, y) {
			return x.SourceIndex - y.SourceIndex;
		});

		var arrStringSegments = [];
		var arrSourceLocationsToCombine = [];
		for (var intIndex = 0; intIndex < arrSourceLocations.length; intIndex++) {
			// If the current sourceLocation overlaps with the previous one (or adjoins it) then they should be combined together (if there
			// isn't a previous sourceLocation then start a new queue)
			var objSourceLocation = arrSourceLocations[intIndex];
			if ((arrSourceLocationsToCombine.length === 0) || (objSourceLocation.SourceIndex <= NewStringSegment(arrSourceLocationsToCombine).EndIndex)) {
				arrSourceLocationsToCombine.push(objSourceLocation);
				continue;
			}

			// If the current sourceLocation marks the start of a new to-highlight segment then add any queued-up sourceLocationsToCombine
			// content to the stringSegments set..
			if (arrSourceLocationsToCombine.length > 0) {
				arrStringSegments.push(NewStringSegment(arrSourceLocationsToCombine));
			}

			// .. and start a new sourceLocationsToCombine list
			arrSourceLocationsToCombine = [ objSourceLocation ];
		}
		if (arrSourceLocationsToCombine.length > 0) {
			arrStringSegments.push(NewStringSegment(arrSourceLocationsToCombine));
		}
		return arrStringSegments;

		function NewStringSegment(arrSourceLocations) {
			var intStartIndex = -1;
			var intEndIndex = -1;
			for (var intIndex = 0; intIndex < arrSourceLocations.length; intIndex++) {
				var objSourceLocation = arrSourceLocations[intIndex];
				if ((intStartIndex === -1) || (objSourceLocation.SourceIndex < intStartIndex)) {
					intStartIndex = objSourceLocation.SourceIndex;
				}
				var intSourceLocationEndIndex = objSourceLocation.SourceIndex + objSourceLocation.SourceTokenLength;
				if ((intEndIndex === -1) || (intSourceLocationEndIndex > intEndIndex)) {
					intEndIndex = intSourceLocationEndIndex;
				}
			}
			return {
				Index: intStartIndex,
				Length: intEndIndex - intStartIndex,
				EndIndex: intEndIndex,
				SourceLocations: arrSourceLocations.slice(0) // Clone array in case the reference is shared elsewhere
			};
		}
	}

	function SearchTermBestMatchComparer(x, y) {
		var intCombinedWeightX = GetCombinedWeight(x);
		var intCombinedWeightY = GetCombinedWeight(y);
		if (intCombinedWeightX !== intCombinedWeightY) {
			return intCombinedWeightY - intCombinedWeightX; // Sort on combined weight descending
		}

		if (x.length !== y.length) {
			return x.length - y.length; // Sort on number of tokens ascending (fewer tokens with same weight should imply "stronger" tokens)
		}

		return GetMinSourceIndex(x) - GetMinSourceIndex(y);

		function GetMinSourceIndex(arrSourceLocations) {
			var intMinSourceIndex = -1;
			for (var intIndex = 0; intIndex < arrSourceLocations.length; intIndex++) {
				if ((intMinSourceIndex === -1) || (arrSourceLocations[intIndex].SourceFieldIndex < intMinSourceIndex)) {
					intMinSourceIndex = arrSourceLocations[intIndex].SourceFieldIndex;
				}
			}
			return intMinSourceIndex;
		}

		function GetCombinedWeight(arrSourceLocations) {
			var intCombinedWeight = 0;
			for (var intIndex = 0; intIndex < arrSourceLocations.length; intIndex++) {
				intCombinedWeight += arrSourceLocations[intIndex].MatchWeightContribution;
			}
			return intCombinedWeight;
		}
	}

	function GetPlainTextContentAsHighlightedHtml(strPlainTextContent, intMaxLengthForHighlightedContent, arrSourceLocations) {
		// IdentifySearchTermsToHighlight will ensure that all arrSourceLocations have the same SourceFieldIndex value (which should correspond
		// to the field that the strContent value has been extracted from)
		var arrMatchesToHighlight = IdentifySearchTermsToHighlight(strPlainTextContent, intMaxLengthForHighlightedContent, arrSourceLocations);

		// Determine which segment of the string to show to highlight the "best" matches that IdentifySearchTermsToHighlight returns
		var intStartIndexOfContent;
		if ((strPlainTextContent.length <= intMaxLengthForHighlightedContent) || (arrMatchesToHighlight.length === 0)) {
			intStartIndexOfContent = 0;
		}
		else {
			arrMatchesToHighlight.sort(function(x, y) { return y.EndIndex - x.EndIndex; }); // Order EndIndex descending
			if (arrMatchesToHighlight[arrMatchesToHighlight.length - 1].EndIndex <= intMaxLengthForHighlightedContent) {
				intStartIndexOfContent = 0;
			}
			else {
				arrMatchesToHighlight.sort(function(x, y) { return x.Index - y.Index; }); // Order Index ascending
				var intStartIndexOfFirstHighlightedTerm = arrMatchesToHighlight[0].Index;
				if (strPlainTextContent.length - intStartIndexOfFirstHighlightedTerm <= intMaxLengthForHighlightedContent) {
					intStartIndexOfContent = strPlainTextContent.length - intMaxLengthForHighlightedContent;
				}
				else {
					intStartIndexOfContent = intStartIndexOfFirstHighlightedTerm;
				}
			}
		}

		// Beginning at this start index, build up a string of content where the highlighted sections are wrapped in "strong" tags (even though the
		// content is plain text, it will need to be html-encoded since plain text content can include characters that should be encoded such as
		// "<" or "&")
		var arrHighlightedContent = [];
		var intEndIndexOfLastSection = intStartIndexOfContent;
		var intLengthOfContentIncluded = 0;
		arrMatchesToHighlight.sort(function(x, y) { return x.Index - y.Index; }); // Order by Index ascending
		for (var intIndex = 0; intIndex < arrMatchesToHighlight.length; intIndex++) {
			var objMatchToHighlight = arrMatchesToHighlight[intIndex];
			if (objMatchToHighlight.Index > intEndIndexOfLastSection)
			{
				var strUnhighlightedContentToAdd = strPlainTextContent.substr(intEndIndexOfLastSection, objMatchToHighlight.Index - intEndIndexOfLastSection);
				arrHighlightedContent.push(
					HtmlEncode(strUnhighlightedContentToAdd)
				);
				intLengthOfContentIncluded += strUnhighlightedContentToAdd.length;
			}

			var strHighlightedContentToAdd = strPlainTextContent.substr(objMatchToHighlight.Index, objMatchToHighlight.Length);
			arrHighlightedContent.push("<strong>");
			arrHighlightedContent.push(
				HtmlEncode(strHighlightedContentToAdd) // Manner of HtmlEncoding
			);
			arrHighlightedContent.push("</strong>");
			intLengthOfContentIncluded += strHighlightedContentToAdd.length;

			intEndIndexOfLastSection = objMatchToHighlight.Index + objMatchToHighlight.Length;
		}

		// If there's any more content that we can fit into the maxLength constraint after the last highlighted section, then get that too
		if ((intLengthOfContentIncluded < intMaxLengthForHighlightedContent) && (strPlainTextContent.length > intEndIndexOfLastSection))
		{
			arrHighlightedContent.push(
				strPlainTextContent.substr(
					intEndIndexOfLastSection,
					Math.min(
						intMaxLengthForHighlightedContent - intLengthOfContentIncluded,
						strPlainTextContent.length - intEndIndexOfLastSection
					)
				)
			);
		}

		// Add leading and/or trailing ellipses to indicate where content has been skipped over		
		if (intStartIndexOfContent > 0) {
			arrHighlightedContent.splice(0, 0, "..");
		}
		if ((intStartIndexOfContent + intMaxLengthForHighlightedContent) < strPlainTextContent.length) {
			arrHighlightedContent.push("..");
		}

		return arrHighlightedContent.join("");

		function HtmlEncode(strValue) {
			var d = document.createElement("div");
			d.innerText = strValue;
			return d.innerHTML;
		}
	}

	return {
		GetPlainTextContentAsHighlightedHtml: GetPlainTextContentAsHighlightedHtml
	};
})();
