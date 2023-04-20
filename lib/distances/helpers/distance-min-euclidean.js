const { euclideanDist } = require("simple-linalg");

module.exports = function(v1, v2) {
	const distance = v1.gallery.map(vec1 => {
		return v2.gallery.map(vec2 => {
			return euclideanDist(vec1, vec2);
		});
	}).reduce((a, b) => a.concat(b));
	return Math.min(...distance);
}