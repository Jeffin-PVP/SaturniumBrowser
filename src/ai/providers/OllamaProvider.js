const OpenAICompatibleProvider = require("./OpenAICompatibleProvider");
class OllamaProvider extends OpenAICompatibleProvider {}
OllamaProvider.id = "ollama";
module.exports = OllamaProvider;
