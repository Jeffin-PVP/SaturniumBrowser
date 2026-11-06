const OpenAICompatibleProvider = require("./OpenAICompatibleProvider");
class CustomProvider extends OpenAICompatibleProvider {}
CustomProvider.id = "custom";
module.exports = CustomProvider;
