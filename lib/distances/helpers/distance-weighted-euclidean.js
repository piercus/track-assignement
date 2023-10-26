const {euclideanDist} = require('simple-linalg');

module.exports = function (v1, v2) {
	if (typeof (v1.vector) === 'undefined' || typeof (v2.vector) === 'undefined') {
		throw new TypeError('v1 or v2 does not have a vector property');
	}

	return euclideanDist(v1.vector, v2.vector);
};
