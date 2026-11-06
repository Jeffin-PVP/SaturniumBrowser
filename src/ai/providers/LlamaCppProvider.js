const OpenAICompatibleProvider = require("./OpenAICompatibleProvider");
class LlamaCppProvider extends OpenAICompatibleProvider {}
LlamaCppProvider.id = "llama.cpp";
module.exports = LlamaCppProvider;
