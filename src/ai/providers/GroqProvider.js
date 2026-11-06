const OpenAICompatibleProvider = require("./OpenAICompatibleProvider");
class GroqProvider extends OpenAICompatibleProvider {}
GroqProvider.id = "groq";
module.exports = GroqProvider;
