class EncodeEnvironmentVariables {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      encode: {
        usage: 'Nothing, just run',
        lifecycleEvents: [
          'run',
        ]
      },
      deploy: {
        lifecycleEvents: [
          'resources'
        ]
      }
    };

    this.hooks = {
      'before:offline:start': this.before.bind(this),
      'before:offline:start:init': this.before.bind(this),
      'before:deploy:resources': this.before.bind(this),
      'before:encode:run': this.before.bind(this),
      'before:invoke:local:invoke': this.before.bind(this),
    };
  }

  before() {
    const providerEncoded = this.encodeProviderVariables();
    const functionEncoded = this.encodeFunctionVariables();
    
    // Write result to stdout
    const output = this.generateOutput(providerEncoded, functionEncoded);
    this.serverless.cli.log(output);
  }

  /**
   * Generate the serverless.cli output to be written to stdout
   * @param {object} providerEncoded - encoded provider variables 
   * @param {object} functionEncoded - encoded function variables
   */
  generateOutput(providerEncoded, functionEncoded) {
    let result = `Base64 encoded environment variables:\nProvider:\n`;

    for(const [ key, value ] of Object.entries(providerEncoded))
      result += `  ${key}: ${value.substr(0, 50)}...\n`;

    result += 'Functions:\n';

    for(const [ funcName, funcVars ] of Object.entries(functionEncoded)) {
      if(Object.keys(funcVars).length === 0) continue;

      result += `  ${funcName}:\n`;
      for(const [ varName, value ] of Object.entries(funcVars))
        result += `    ${varName}: ${value.substr(0, 50)}...\n`;
    }

    return result;
  }

  /**
   * Base64 encode a list of variables from services.provider
   */
  encodeProviderVariables() {
    const allVariables = Object.assign({}, this.serverless.service.provider.environment);
    const providerVarsToEncode = this.getProviderVariablesToEncode();
    
    const encoded = {};
    for(const variable of providerVarsToEncode)
      encoded[variable] = this.encode(allVariables[variable]);

    Object.assign(this.serverless.service.provider.environment, encoded);
  
    return encoded;
  }

  /**
   * Base64 encode a given object
   * @param {object} obj 
   */
  encode(obj) {
    return new Buffer(JSON.stringify(obj)).toString('base64');
  }

  /**
   * Search for environment variables mentioned in service.provider
   * that are typeof object
   * @returns {array} - An array of variable names to encode
   */
  getProviderVariablesToEncode() {
    const vars = Object.assign({}, this.serverless.service.provider.environment);
    // An array of varible names to encode
    let varsToEncode = [];

    // Check if using custom.encodeEnvObjects
    if(this.serverless.service.custom && this.serverless.service.custom.encodeEnvObjects)
      varsToEncode = this.serverless.service.custom.encodeEnvObjects;

    // Otherwise get all variables from service.provider
    else
      varsToEncode = Object.keys(vars);

    // Return the names of variables that are typeof object
    return Object.entries(vars)
      .filter(([ key, value ]) => varsToEncode.includes(key) && typeof value === 'object')
      .map(([ key, value ]) => key);
  }

  /**
   * Search for environment variables mentioned in service.functions
   * that are typeof object, base64 encode them, and reassign to function.environment
   * @returns {array} - An array of objects that have been encoded
   */
  encodeFunctionVariables() {
    const result = {};
    
    const functions = this.serverless.service.functions;
    
    for(const [ funcName, func ] of Object.entries(functions)) {
      const vars = Object.assign({}, func.environment);
      
      // If no environment variables listed, skip this function
      if(Object.keys(vars).length === 0) continue;

      let varsToEncode = [];
      
      if(this.serverless.service.custom && this.serverless.service.custom.encodeEnvObjects)
        varsToEncode = this.serverless.service.custom.encodeEnvObjects;
      
      else
        varsToEncode = Object.keys(vars);

      const encoded = {};
      for(const [ key, value ] of Object.entries(vars))
        if(varsToEncode.includes(key) && typeof value === 'object')
          encoded[key] = this.encode(value);

      result[funcName] = encoded;

      // Reassign encoded variables to function.environment
      Object.assign(func.environment, encoded);

    }

    return result;
  }
}

module.exports = EncodeEnvironmentVariables;
