class AbstractPostProcess {
	constructor(options) {
		const {logger} = options;
		this.logger = logger;
	}
}

module.exports = AbstractPostProcess;
