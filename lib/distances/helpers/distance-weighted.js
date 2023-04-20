const {cosSimilarity} = require('simple-linalg');
module.exports = function (v1, v2) {
	const inverted = (1 - cosSimilarity(v1.vector, v2.vector));
	return inverted * inverted;
};
