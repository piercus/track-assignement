const identity = o => o;

module.exports = function (args, {distances, order, fnName}) {
	if (!order) {
		order = Object.keys(distances);
	}

	const result = {};
	order.forEach(k => {
		// Const startTime = new Date();
		const mapFn = distances[k][fnName] || identity;
		result[k] = mapFn(...args);
	});
	return result;
};
