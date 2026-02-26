from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from math import isfinite

from django.shortcuts import render
from django.utils.translation import get_language


CURRENCIES = {
    "TRY": "₺",
    "USD": "$",
    "EUR": "€",
}

LANGUAGE_OPTIONS = [
    {"code": "tr", "name": "Türkçe"},
    {"code": "en", "name": "English"},
    {"code": "de", "name": "Deutsch"},
    {"code": "es", "name": "Español"},
    {"code": "it", "name": "Italiano"},
    {"code": "ru", "name": "Русский"},
    {"code": "fr", "name": "Français"},
]

TEXTS = {
    "tr": {
        "page_title": "Optimal Fiyat Hesaplayıcı",
        "language": "Dil",
        "change_language": "Değiştir",
        "point_1": "Veri Noktası 1",
        "point_2": "Veri Noktası 2",
        "price_1": "Fiyat 1",
        "demand_1": "Talep 1",
        "price_2": "Fiyat 2",
        "demand_2": "Talep 2",
        "currency": "Para Birimi",
        "calculate": "Hesapla",
        "results": "Sonuçlar",
        "demand_formula": "Talep denklemi",
        "profit_formula": "Kazanç denklemi",
        "best_price": "En iyi fiyat",
        "expected_demand": "Beklenen talep",
        "max_profit": "Maksimum kazanç",
        "chart_title": "Kazanç Grafiği (fiyata göre)",
        "chart_x": "Fiyat",
        "chart_y": "Kazanç",
        "legend_curve": "Kazanç eğrisi",
        "legend_data_points": "Veri noktaları",
        "legend_optimal": "Optimal fiyat",
        "error_numbers": "Lütfen tüm alanlara sayı giriniz.",
        "error_same_price": "İki fiyat aynı olamaz.",
        "error_no_optimum": "Bu veriyle optimum fiyat hesaplanamıyor.",
    },
    "en": {
        "page_title": "Optimal Price Calculator",
        "language": "Language",
        "change_language": "Change",
        "point_1": "Data Point 1",
        "point_2": "Data Point 2",
        "price_1": "Price 1",
        "demand_1": "Demand 1",
        "price_2": "Price 2",
        "demand_2": "Demand 2",
        "currency": "Currency",
        "calculate": "Calculate",
        "results": "Results",
        "demand_formula": "Demand formula",
        "profit_formula": "Profit formula",
        "best_price": "Best price",
        "expected_demand": "Expected demand",
        "max_profit": "Maximum profit",
        "chart_title": "Profit Chart (by price)",
        "chart_x": "Price",
        "chart_y": "Profit",
        "legend_curve": "Profit curve",
        "legend_data_points": "Data points",
        "legend_optimal": "Optimal price",
        "error_numbers": "Please enter numbers in all fields.",
        "error_same_price": "The two prices cannot be the same.",
        "error_no_optimum": "This data does not produce an optimal price.",
    },
    "de": {
        "page_title": "Optimaler Preisrechner",
        "language": "Sprache",
        "change_language": "Ändern",
        "point_1": "Datenpunkt 1",
        "point_2": "Datenpunkt 2",
        "price_1": "Preis 1",
        "demand_1": "Nachfrage 1",
        "price_2": "Preis 2",
        "demand_2": "Nachfrage 2",
        "currency": "Währung",
        "calculate": "Berechnen",
        "results": "Ergebnisse",
        "demand_formula": "Nachfragegleichung",
        "profit_formula": "Gewinngleichung",
        "best_price": "Bester Preis",
        "expected_demand": "Erwartete Nachfrage",
        "max_profit": "Maximaler Gewinn",
        "chart_title": "Gewinngrafik (nach Preis)",
        "chart_x": "Preis",
        "chart_y": "Gewinn",
        "legend_curve": "Gewinnkurve",
        "legend_data_points": "Datenpunkte",
        "legend_optimal": "Optimaler Preis",
        "error_numbers": "Bitte geben Sie in allen Feldern Zahlen ein.",
        "error_same_price": "Die beiden Preise dürfen nicht gleich sein.",
        "error_no_optimum": "Mit diesen Daten kann kein optimaler Preis berechnet werden.",
    },
    "es": {
        "page_title": "Calculadora de Precio Óptimo",
        "language": "Idioma",
        "change_language": "Cambiar",
        "point_1": "Punto de Datos 1",
        "point_2": "Punto de Datos 2",
        "price_1": "Precio 1",
        "demand_1": "Demanda 1",
        "price_2": "Precio 2",
        "demand_2": "Demanda 2",
        "currency": "Moneda",
        "calculate": "Calcular",
        "results": "Resultados",
        "demand_formula": "Ecuación de demanda",
        "profit_formula": "Ecuación de ganancia",
        "best_price": "Mejor precio",
        "expected_demand": "Demanda esperada",
        "max_profit": "Ganancia máxima",
        "chart_title": "Gráfico de Ganancia (por precio)",
        "chart_x": "Precio",
        "chart_y": "Ganancia",
        "legend_curve": "Curva de ganancia",
        "legend_data_points": "Puntos de datos",
        "legend_optimal": "Precio óptimo",
        "error_numbers": "Introduce números en todos los campos.",
        "error_same_price": "Los dos precios no pueden ser iguales.",
        "error_no_optimum": "Estos datos no producen un precio óptimo.",
    },
    "it": {
        "page_title": "Calcolatore Prezzo Ottimale",
        "language": "Lingua",
        "change_language": "Cambia",
        "point_1": "Punto Dati 1",
        "point_2": "Punto Dati 2",
        "price_1": "Prezzo 1",
        "demand_1": "Domanda 1",
        "price_2": "Prezzo 2",
        "demand_2": "Domanda 2",
        "currency": "Valuta",
        "calculate": "Calcola",
        "results": "Risultati",
        "demand_formula": "Equazione della domanda",
        "profit_formula": "Equazione del profitto",
        "best_price": "Prezzo migliore",
        "expected_demand": "Domanda prevista",
        "max_profit": "Profitto massimo",
        "chart_title": "Grafico del Profitto (per prezzo)",
        "chart_x": "Prezzo",
        "chart_y": "Profitto",
        "legend_curve": "Curva del profitto",
        "legend_data_points": "Punti dati",
        "legend_optimal": "Prezzo ottimale",
        "error_numbers": "Inserisci numeri in tutti i campi.",
        "error_same_price": "I due prezzi non possono essere uguali.",
        "error_no_optimum": "Questi dati non producono un prezzo ottimale.",
    },
    "ru": {
        "page_title": "Калькулятор Оптимальной Цены",
        "language": "Язык",
        "change_language": "Изменить",
        "point_1": "Точка Данных 1",
        "point_2": "Точка Данных 2",
        "price_1": "Цена 1",
        "demand_1": "Спрос 1",
        "price_2": "Цена 2",
        "demand_2": "Спрос 2",
        "currency": "Валюта",
        "calculate": "Рассчитать",
        "results": "Результаты",
        "demand_formula": "Формула спроса",
        "profit_formula": "Формула прибыли",
        "best_price": "Лучшая цена",
        "expected_demand": "Ожидаемый спрос",
        "max_profit": "Максимальная прибыль",
        "chart_title": "График Прибыли (по цене)",
        "chart_x": "Цена",
        "chart_y": "Прибыль",
        "legend_curve": "Кривая прибыли",
        "legend_data_points": "Точки данных",
        "legend_optimal": "Оптимальная цена",
        "error_numbers": "Введите числа во всех полях.",
        "error_same_price": "Две цены не могут быть одинаковыми.",
        "error_no_optimum": "Эти данные не дают оптимальную цену.",
    },
    "fr": {
        "page_title": "Calculateur de Prix Optimal",
        "language": "Langue",
        "change_language": "Changer",
        "point_1": "Point de Données 1",
        "point_2": "Point de Données 2",
        "price_1": "Prix 1",
        "demand_1": "Demande 1",
        "price_2": "Prix 2",
        "demand_2": "Demande 2",
        "currency": "Devise",
        "calculate": "Calculer",
        "results": "Résultats",
        "demand_formula": "Équation de la demande",
        "profit_formula": "Équation du profit",
        "best_price": "Meilleur prix",
        "expected_demand": "Demande attendue",
        "max_profit": "Profit maximal",
        "chart_title": "Graphique du Profit (par prix)",
        "chart_x": "Prix",
        "chart_y": "Profit",
        "legend_curve": "Courbe du profit",
        "legend_data_points": "Points de données",
        "legend_optimal": "Prix optimal",
        "error_numbers": "Veuillez saisir des nombres dans tous les champs.",
        "error_same_price": "Les deux prix ne peuvent pas être identiques.",
        "error_no_optimum": "Ces données ne produisent pas de prix optimal.",
    },
}


def _to_decimal(value: str) -> Decimal:
    return Decimal(str(value).replace(",", ".").strip())


def _build_chart_data(a: Decimal, b: Decimal, p1: Decimal, q1: Decimal, p2: Decimal, q2: Decimal, p_opt: Decimal):
    width, height = 700, 280
    left, right, top, bottom = 56, 20, 20, 42
    chart_width = width - left - right
    chart_height = height - top - bottom

    candidates = [float(p1), float(p2), float(p_opt)]
    x_max_raw = max(candidates)
    x_min = 0.0 if min(candidates) >= 0 else min(candidates) * 1.2
    x_max = (x_max_raw * 1.3) if x_max_raw > 0 else 10.0
    if x_max <= x_min:
        x_max = x_min + 10.0

    def revenue(price: float) -> float:
        demand = float(a) + float(b) * price
        return price * demand

    raw_points = []
    for i in range(60):
        x = x_min + ((x_max - x_min) * i / 59)
        y = revenue(x)
        if isfinite(y):
            raw_points.append((x, y))

    if not raw_points:
        return None

    y_values = [point[1] for point in raw_points]
    y_values.extend([float(p1 * q1), float(p2 * q2), float(p_opt * (a + b * p_opt))])
    y_min = min(y_values)
    y_max = max(y_values)
    if y_max == y_min:
        y_max = y_min + 1

    def sx(x: float) -> float:
        return left + ((x - x_min) / (x_max - x_min)) * chart_width

    def sy(y: float) -> float:
        return top + (1 - (y - y_min) / (y_max - y_min)) * chart_height

    path = " ".join(
        [f"{'M' if idx == 0 else 'L'} {sx(x):.2f} {sy(y):.2f}" for idx, (x, y) in enumerate(raw_points)]
    )

    p1x = float(p1)
    p2x = float(p2)
    opx = float(p_opt)
    p1y = float(p1 * q1)
    p2y = float(p2 * q2)
    opy = float(p_opt * (a + b * p_opt))

    return {
        "width": width,
        "height": height,
        "left": left,
        "top": top,
        "bottom_y": top + chart_height,
        "right_x": left + chart_width,
        "x_axis_y": sy(0) if y_min <= 0 <= y_max else top + chart_height,
        "y_axis_x": sx(0) if x_min <= 0 <= x_max else left,
        "path": path,
        "p1x": sx(p1x),
        "p1y": sy(p1y),
        "p2x": sx(p2x),
        "p2y": sy(p2y),
        "opx": sx(opx),
        "opy": sy(opy),
        "x_min": round(x_min, 2),
        "x_max": round(x_max, 2),
        "y_min": round(y_min, 2),
        "y_max": round(y_max, 2),
    }


def home(request):
    current_language = (get_language() or "tr").split("-")[0]
    labels = TEXTS.get(current_language, TEXTS["en"])
    selected_currency = request.POST.get("currency", "TRY")
    context = {
        "labels": labels,
        "current_language": current_language,
        "language_options": LANGUAGE_OPTIONS,
        "currencies": CURRENCIES,
        "selected_currency": selected_currency,
        "selected_symbol": CURRENCIES.get(selected_currency, "₺"),
    }
    if request.method != "POST":
        return render(request, "core/home.html", context)

    try:
        p1 = _to_decimal(request.POST.get("price_1", ""))
        q1 = _to_decimal(request.POST.get("demand_1", ""))
        p2 = _to_decimal(request.POST.get("price_2", ""))
        q2 = _to_decimal(request.POST.get("demand_2", ""))
    except (InvalidOperation, ValueError):
        context["error"] = labels["error_numbers"]
        return render(request, "core/home.html", context)

    if p1 == p2:
        context["error"] = labels["error_same_price"]
        return render(request, "core/home.html", context)

    b = (q2 - q1) / (p2 - p1)
    a = q1 - (b * p1)

    if b == 0:
        context["error"] = labels["error_no_optimum"]
        return render(request, "core/home.html", context)

    optimal_price = -(a / (2 * b))
    expected_demand = a + (b * optimal_price)
    max_profit = optimal_price * expected_demand

    def round2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    context["result"] = {
        "a": round2(a),
        "b": round2(b),
        "optimal_price": round2(optimal_price),
        "expected_demand": round2(expected_demand),
        "max_profit": round2(max_profit),
    }
    context["inputs"] = {
        "price_1": p1,
        "demand_1": q1,
        "price_2": p2,
        "demand_2": q2,
    }
    context["chart"] = _build_chart_data(a, b, p1, q1, p2, q2, optimal_price)
    return render(request, "core/home.html", context)
