'use babel';


const HINT_LIMIT			= 10;

const URL_PHP_BASE		= 'https://www.php.net';
const URL_PHP_SEARCH	= '/manual-lookup.php?pattern=';


class HintProvider {
	constructor() {
		this.selector = '.text.php';
		//this.selector = '*';

		// Appear above default suggestions
		this.suggestionPriority = 2;
	}


	getSuggestions ( options ) {
		const { editor, bufferPosition } = options;

		let prefix = this.getPrefix(editor, bufferPosition);
		let match = prefix.match(/^([a-zA-Z0-9_-]{1,}) ?\(\)?$/);

		return match ? this.findMatchingSuggestions(match[0], match[1].toLowerCase()) : false;
	}


	getPrefix ( editor, bufferPosition ) {
		let line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
		let match = line.match(/\S+$/);

		return match ? match[0] : '';
	}


	findMatchingSuggestions ( prefix, lookup ) {

		let self = this;
		let doc = new DOMParser();

		return new Promise((resolve) => {
			fetch(URL_PHP_BASE + URL_PHP_SEARCH + '*' + lookup + '*')
				.then((lookup) => {
					return lookup.text();
				})
				.then((results) => {

					//	Search php.net and parse results

					let body = doc.parseFromString(results, 'text/html');
					let links = body.evaluate('//*[@id="quickref_functions"]//a//*[text()[contains(.,"'+lookup+'")]]/.. | //*[@id="quickref_functions"]//a[text()[contains(.,"'+lookup+'")]]', body, null, XPathResult.ANY_TYPE, null);

					let i = 0;
					let data = [];
					while ( (entry = links.iterateNext()) && i < HINT_LIMIT ) {
						data.push({ 'text': entry.text, 'link': URL_PHP_BASE + entry.getAttribute('href'), 'hint': '', 'title': '' });
						i++;
				 	};

					// Maps each URL into a fetch() Promise

					var requests = data.map(function(entry) {
					  return fetch(entry.link)
					  .then(function(response) {
							return response.text();
					  })
					});

					// Resolve all the promises

					Promise.all(requests)
						.then((results) => {

							let expanded = [];
							results.forEach(function(result) {

								// Parse result pages individually
								let body = doc.parseFromString(result, 'text/html');

								let element;
								let desc = (element = body.getElementsByClassName('dc-description')[0]) ? element.textContent.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim() : '';
								let title = (element = body.getElementsByClassName('dc-title')[0]) ? element.textContent.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim() : '';
								let name = (element = body.getElementsByClassName('methodname')[0]) ? element.textContent.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim() : '';

								// Match search result data with fetched descriptions & generate hint menu
								let entry = data.find(x => x.text == name);
						    if ( typeof(entry) !== 'undefined' )
									expanded.push(self.inflateSuggestion(prefix, { 'text': entry.text, 'hint': desc, 'title': title, 'link': entry.link }));

								resolve(expanded);
							});
						}).catch(function(err) {
						  console.log(err);
						});
				})
				.catch((err) => {
					console.log(err);
				});
		});
	}


	inflateSuggestion ( typed, suggestion ) {
		return {
			//text: suggestion.text,
			displayText: suggestion.text,
			description: suggestion.hint + "\n\n" + suggestion.title,
			descriptionMoreURL: suggestion.link,
			type: 'value',
			iconHTML: '<i class="icon-settings"></i>',
			replacementPrefix: typed,
			snippet: typed.replace( typed.replace(new RegExp('[ \(]+$'), ''), suggestion.text ),
			rightLabelHTML: '<span class="phpnethints-rightlabel">' + suggestion.title + '</span>'
		};
	}

}
export default new HintProvider();
