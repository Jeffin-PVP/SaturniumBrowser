const OpenAICompatibleProvider = require("./OpenAICompatibleProvider");
class OpenAIProvider extends OpenAICompatibleProvider {}
OpenAIProvider.id = "openai";
module.exports = OpenAIProvider;
