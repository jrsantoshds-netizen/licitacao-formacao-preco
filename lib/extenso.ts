export function valorPorExtenso(numero: number): string {
    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const dez1 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const dezenas = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    const getExtenso = (num: number): string => {
        if (num === 100) return "cem";
        let str = "";
        const c = Math.floor(num / 100);
        const d = Math.floor((num % 100) / 10);
        const u = num % 10;

        if (c > 0) {
            str += centenas[c];
            if (d > 0 || u > 0) str += " e ";
        }
        if (d === 1) {
            str += dez1[u];
        } else {
            if (d > 1) {
                str += dezenas[d];
                if (u > 0) str += " e ";
            }
            if (u > 0) {
                str += unidades[u];
            }
        }
        return str;
    };

    const extensoMenorQueMilhao = (n: number): string => {
        if (n === 0) return "";
        let str = "";
        if (n >= 1000) {
            const milhares = Math.floor(n / 1000);
            if (milhares === 1) {
                str += "mil"; 
            } else {
                str += getExtenso(milhares) + " mil";
            }
            const resto = n % 1000;
            if (resto > 0) {
                if (resto < 100 || resto % 100 === 0) {
                    str += " e " + getExtenso(resto);
                } else {
                    str += " " + getExtenso(resto);
                }
            }
        } else {
            str = getExtenso(n);
        }
        return str;
    };

    if (numero === 0) return "zero reais";

    const reais = Math.floor(Math.abs(numero));
    const centavos = Math.round((Math.abs(numero) - reais) * 100);

    let reaisStr = "";
    if (reais > 0) {
        if (reais >= 1000000) {
            const milhoes = Math.floor(reais / 1000000);
            reaisStr += extensoMenorQueMilhao(milhoes) + (milhoes === 1 ? " milhão" : " milhões");
            const resto = reais % 1000000;
            if (resto > 0) reaisStr += (resto < 100000 || resto % 100000 === 0 ? " e " : " ") + extensoMenorQueMilhao(resto);
        } else {
            reaisStr = extensoMenorQueMilhao(reais);
        }
        reaisStr += reais === 1 ? " real" : " reais";
    }

    let centavosStr = "";
    if (centavos > 0) {
        centavosStr = extensoMenorQueMilhao(centavos) + (centavos === 1 ? " centavo" : " centavos");
    }

    let result = "";
    if (reaisStr && centavosStr) result = reaisStr + " e " + centavosStr;
    else if (reaisStr) result = reaisStr;
    else result = centavosStr;

    return numero < 0 ? "menos " + result : result;
}
