const recursiveDeepCopy = function (inObject) {
	let value;

	if (typeof inObject !== 'object' || inObject === null) {
		return inObject; // Return the value if inObject is not an object
	}

	// Create an array or object to hold the values
	const outObject = Array.isArray(inObject) ? [] : {};

	Object.keys(inObject).forEach(key => {
		value = inObject[key];

		// Recursively (deep) copy for nested objects, including arrays
		outObject[key] = recursiveDeepCopy(value);
	});

	return outObject;
};

module.exports = recursiveDeepCopy;
