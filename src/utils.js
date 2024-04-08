/**
 * @param {string} uriString
 * @returns {string}
 */
function getModuleNameFromUri(uriString) {
	return uriString.substring(uriString.lastIndexOf('/') + 1).replace('.lua', '');
}

module.exports = {
	getModuleNameFromUri,
};