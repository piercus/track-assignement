const {cosSimilarity} = require('simple-linalg');
module.exports = function (v1, v2) {
	const inverted = (1 - cosSimilarity(v1.vector, v2.vector));
	const result = inverted * inverted;
	if (Number.isNaN(result)) {
		console.log(result, v1.vector, v2.vector);
		throw (new Error('NaN result'));
	}

	return result;
};
