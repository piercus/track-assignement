const {dotProduct} = require('simple-linalg');
const {norm} = require('simple-linalg');

module.exports = function (vector1, vector2) {
	if (vector1.length !== vector2.length) {
		throw (new Error('The lengths of the vectors do not match'));
	}

	return dotProduct(vector1, vector2) / (norm(vector1) * norm(vector2));
};
