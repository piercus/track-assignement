const mahalanobis = require('./mahalanobis');

module.exports = function (options) {
	options.mahalanobis = options['sq-mahalanobis'];
	const distance = mahalanobis(options);

	return Object.assign({}, distance, {
		fn: (...options_) => {
			const result = distance.fn(...options_);
			return result * result;
		}
	});
};
