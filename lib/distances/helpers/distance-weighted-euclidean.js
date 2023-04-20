const {euclideanDist} = require('simple-linalg');

module.exports = function (v1, v2) {
	return euclideanDist(v1.vector, v2.vector);
};
