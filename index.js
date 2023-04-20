module.exports = {
	GlobalMatching: require('./lib/global-matching'),
	MatchingStage: require('./lib/matching-stage'),
	getDistances: require('./lib/matching-cascade/get-distances'),
	lambdaSumDistances: require('./lib/matching-cascade/lambda-sum-distances')
};
