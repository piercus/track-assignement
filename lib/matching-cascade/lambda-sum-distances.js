module.exports = function ({
	lambdas,
	values,
	keys
}) {
	const result = keys.map(k => lambdas[k] * values[k]).reduce((a, b) => a + b, 0);
	if (Number.isNaN(result)) {
		console.log(values, lambdas);
		throw (new Error('Sum is NaN'));
	}

	return result;
};
