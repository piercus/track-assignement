const mahalanobis = require('./sq-forward-mahalanobis-track');

module.exports = function (options) {
	const distance = mahalanobis(options);

	return Object.assign({}, distance, {
		fn: (...options) => {
			const result = distance.fn(...options);
			return Math.sqrt(result);
		}
	});
};
