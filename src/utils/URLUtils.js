class URLUtils {


    static isVoidURL(value) {

        return /^void:\/\//i.test(value);

    }


    static isHTTP(value) {

        return /^https?:\/\//i.test(value);

    }


    static isLocalhost(value) {

        return /^localhost(?::\d+)?(?:\/.*)?$/i.test(value);

    }


    static isIPAddress(value) {

        return /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/.*)?$/i.test(value);

    }


    static isDomain(value) {

        return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/:?#].*)?$/i.test(value);

    }


    static normalize(input) {

        const value = input.trim();

        if (!value) {
            return null;
        }


        // HTTP/HTTPS

        if (this.isHTTP(value)) {
            return {
                type: "url",
                url: value
            };
        }


        // Localhost

        if (this.isLocalhost(value)) {
            return {
                type: "url",
                url: "http://" + value
            };
        }


        // IP

        if (this.isIPAddress(value)) {
            return {
                type: "url",
                url: "http://" + value
            };
        }


        // Domínio

        if (this.isDomain(value)) {
            return {
                type: "url",
                url: "https://" + value
            };
        }


        // Pesquisa (mecanismo próprio do
        // VoidBrowser, não depende do Google)

        return {
            type: "search",
            query: value,

            url:
                "void://search?q=" +
                encodeURIComponent(value)
        };

    }

}


module.exports = URLUtils;