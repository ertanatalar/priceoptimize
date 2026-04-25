from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from math import isfinite
import os
import re

from django.http import HttpResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.translation import get_language
from django.utils import timezone


CURRENCIES = {
    "TRY": "₺",
    "USD": "$",
    "EUR": "€",
}

ENGINE_MENU = [
    {"path": "/price-demand/", "enabled": True},
    {"path": "/price-demand/discount-optimizer/", "enabled": True},
]

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
        "page_intro": "Gecmisteki talep sayisi ve fiyat bilgilerinden yola cikarak optimum fiyat degerini bulur.",
        "language": "Dil",
        "change_language": "Değiştir",
        "point_1": "Veri Noktası 1",
        "point_2": "Veri Noktası 2",
        "price_1": "1. Satis Fiyati",
        "demand_1": "1. Talep Sayisi",
        "price_2": "2. Satis Fiyati",
        "demand_2": "2. Talep Sayisi",
        "currency": "Para Birimi",
        "unit_cost": "Birim Maliyet",
        "method": "Optimizasyon Yontemi",
        "method_closed_form": "Kapali Form",
        "method_grg": "Nonlinear GRG (iteratif)",
        "method_used": "Kullanilan yontem",
        "no_profit_note": "Bu girdilerle pozitif kar olusmuyor. En iyi sonuc zarar etmemek icin satis yapmamak (kar = 0).",
        "calculate": "Hesapla",
        "menu_engines": "Motorlar",
        "engine_price_demand_title": "Fiyat ve Satis Hesaplayici",
        "engine_price_demand_desc": "Iki fiyat bilgisinden en cok kazandiran fiyati bulur.",
        "engine_discount_title": "Indirim Etki Motoru",
        "engine_discount_desc": "Kalkulus tabanli fiyat indirimi modeli: her indirim adiminda satis artisini kullanarak maksimum kari bulur.",
        "go_to_engine": "Hesapla",
        "results": "Sonuçlar",
        "demand_formula": "Talep denklemi",
        "profit_formula": "Kar denklemi",
        "best_price": "En iyi fiyat",
        "expected_demand": "Beklenen talep",
        "max_profit": "Maksimum kar",
        "chart_title": "Kar Grafigi (fiyata gore)",
        "chart_x": "Fiyat",
        "chart_y": "Kar",
        "legend_curve": "Kar egrisi",
        "legend_data_points": "Veri noktaları",
        "legend_optimal": "Optimal fiyat",
        "error_numbers": "Lütfen tüm alanlara sayı giriniz.",
        "error_same_price": "İki fiyat aynı olamaz.",
        "error_no_optimum": "Bu veriyle optimum fiyat hesaplanamıyor.",
        "portal_title": "Urunlerinizin fiyatini optimize edin",
        "discount_page_title": "Indirim Sonrasi Satis Etkisi",
        "discount_prompt_label": "Ne Hesaplanacak? (Opsiyonel)",
        "discount_prompt_placeholder": "Ornek: Kari maksimize et veya en iyi fiyati bul.",
        "discount_hint": "Her satira bir cumle yazin. + ile yeni cumle satiri ekleyebilirsiniz.",
        "discount_example": "Ornek satirlar: 100 adet urunu 1 TL'den sattim. / 0,05 TL indirim yapinca 110 adet sattim.",
        "discount_fields_title": "Veri Cumleleri",
        "discount_field_name": "Cumle",
        "discount_add_row": "+ Cumle Ekle",
        "discount_remove_row": "Sil",
        "discount_speech_input": "Sesle Veri Girisi",
        "discount_speech_start": "Mikrofonu Baslat",
        "discount_speech_stop": "Durdur",
        "discount_speech_ready": "Mikrofona tiklayip konusabilirsiniz.",
        "discount_speech_listening": "Dinleniyor... Konusmaya devam edin.",
        "discount_speech_not_supported": "Bu tarayici sesle veri girisini desteklemiyor.",
        "discount_result_title": "Motor Sonucu",
        "discount_step_model_title": "Kalkulus Modeli (Video Algoritmasi)",
        "discount_step_rule": "Kural",
        "discount_step_rule_value": "Her {step} indirimde satis {extra} adet artiyor",
        "discount_profit_function": "Kar fonksiyonu",
        "discount_optimal_reductions": "Optimum indirim adimi sayisi",
        "discount_optimal_price_step": "Optimum satis fiyati",
        "discount_optimal_qty_step": "Optimum satis adedi",
        "discount_optimal_profit_step": "Maksimum kar (kalkulus modeli)",
        "discount_input_summary": "Girilen degerler",
        "discount_base_revenue": "Indirim oncesi gelir",
        "discount_new_revenue": "Indirim sonrasi gelir",
        "discount_base_profit": "Indirim oncesi kar",
        "discount_new_profit": "Indirim sonrasi kar",
        "discount_model_profit": "Modelde en yuksek kar",
        "discount_recommendation": "Onerilen senaryo",
        "discount_scenario_keep": "Normal fiyatla devam et",
        "discount_scenario_discount": "Indirimli fiyatla sat",
        "discount_objective": "Hedef",
        "discount_objective_profit": "Kar maksimizasyonu",
        "discount_objective_revenue": "Gelir maksimizasyonu",
        "discount_delta": "Gelir farki",
        "discount_extra_units": "Ekstra satis adedi",
        "discount_after_units": "Indirim sonrasi toplam adet",
        "discount_after_price": "Indirimli fiyat",
        "discount_model_formula": "Talep modeli",
        "discount_best_price": "Modelin onerilen en iyi fiyati",
        "discount_best_demand": "Modelde beklenen satis adedi",
        "discount_best_revenue": "Modelde en yuksek gelir",
        "discount_all_scenarios": "Tum senaryo karsilastirmasi",
        "discount_case_current": "Mevcut fiyat senaryosu",
        "discount_case_discount": "Indirimli fiyat senaryosu",
        "discount_case_optimal": "Modelin optimum fiyat senaryosu",
        "discount_optimal_discount": "Mevcut fiyata gore onerilen optimum indirim",
        "discount_error_parse": "Gerekli veriler okunamadi. Kutucuklarda en az urun adedi, urun fiyati, indirim tutari ve indirim sonrasi toplam adedi girin.",
        "privacy_link": "Gizlilik Politikasi",
        "privacy_title": "Gizlilik Politikasi",
        "privacy_intro": "PriceOptimize.ai kullanicilarinin gizliligine onem verir.",
        "privacy_section_data": "Toplanan Veriler",
        "privacy_data_text": "Hesaplama formlarina girdiginiz veriler servis calismasi icin islenir. Hassas odeme karti bilgileri bu uygulama tarafinda toplanmaz.",
        "privacy_section_ads": "Reklam ve Cerezler",
        "privacy_ads_text": "Site gelecekte reklam servisleri kullanabilir. Bu durumda cerez kullanimi ve reklam tercihleri ilgili politika araclariyla yonetilir.",
        "privacy_section_contact": "Iletisim",
        "privacy_contact_text": "Gizlilikle ilgili talepleriniz icin: admin@priceoptimize.ai",
    },
    "en": {
        "page_title": "Optimal Price Calculator",
        "page_intro": "Finds the optimal price based on historical demand counts and price data.",
        "language": "Language",
        "change_language": "Change",
        "point_1": "Data Point 1",
        "point_2": "Data Point 2",
        "price_1": "1st Sale Price",
        "demand_1": "1st Demand Quantity",
        "price_2": "2nd Sale Price",
        "demand_2": "2nd Demand Quantity",
        "currency": "Currency",
        "unit_cost": "Unit Cost",
        "method": "Optimization Method",
        "method_closed_form": "Closed Form",
        "method_grg": "Nonlinear GRG (iterative)",
        "method_used": "Method used",
        "no_profit_note": "With these inputs, positive profit is not feasible. Best outcome is not selling (profit = 0).",
        "calculate": "Calculate",
        "menu_engines": "Engines",
        "engine_price_demand_title": "Price-Demand Engine",
        "engine_price_demand_desc": "Builds demand model and profit optimization from two data points.",
        "engine_discount_title": "Discount Impact Engine",
        "engine_discount_desc": "Calculus-based price reduction model: finds maximum profit using step discount and demand increase.",
        "go_to_engine": "Open Engine",
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
        "portal_title": "Optimize your product prices",
        "discount_page_title": "Post-Discount Sales Impact",
        "discount_prompt_label": "What Should Be Calculated? (Optional)",
        "discount_prompt_placeholder": "Example: Maximize profit or find best price.",
        "discount_hint": "Write one sentence per line. Use + to add a new sentence line.",
        "discount_example": "Example lines: I sold 100 units at 1 TL. / After a 0.05 TL discount, I sold 110 units.",
        "discount_fields_title": "Data Sentences",
        "discount_field_name": "Sentence",
        "discount_add_row": "+ Add Sentence",
        "discount_remove_row": "Remove",
        "discount_speech_input": "Voice Input",
        "discount_speech_start": "Start Microphone",
        "discount_speech_stop": "Stop",
        "discount_speech_ready": "Click the microphone and speak your inputs.",
        "discount_speech_listening": "Listening... Keep speaking.",
        "discount_speech_not_supported": "This browser does not support voice input.",
        "discount_result_title": "Engine Result",
        "discount_step_model_title": "Calculus Model (Video Algorithm)",
        "discount_step_rule": "Rule",
        "discount_step_rule_value": "For every {step} discount, sales increase by {extra} units",
        "discount_profit_function": "Profit function",
        "discount_optimal_reductions": "Optimal number of discount steps",
        "discount_optimal_price_step": "Optimal selling price",
        "discount_optimal_qty_step": "Optimal sold quantity",
        "discount_optimal_profit_step": "Maximum profit (calculus model)",
        "discount_input_summary": "Input summary",
        "discount_base_revenue": "Revenue before discount",
        "discount_new_revenue": "Revenue after discount",
        "discount_base_profit": "Profit before discount",
        "discount_new_profit": "Profit after discount",
        "discount_model_profit": "Highest model profit",
        "discount_recommendation": "Recommended scenario",
        "discount_scenario_keep": "Keep normal price",
        "discount_scenario_discount": "Sell with discounted price",
        "discount_objective": "Objective",
        "discount_objective_profit": "Profit maximization",
        "discount_objective_revenue": "Revenue maximization",
        "discount_delta": "Revenue delta",
        "discount_extra_units": "Extra units sold",
        "discount_after_units": "Total units after discount",
        "discount_after_price": "Discounted price",
        "discount_model_formula": "Demand model",
        "discount_best_price": "Model recommended best price",
        "discount_best_demand": "Expected units at best price",
        "discount_best_revenue": "Highest revenue in model",
        "discount_all_scenarios": "All scenario comparison",
        "discount_case_current": "Current price scenario",
        "discount_case_discount": "Discounted price scenario",
        "discount_case_optimal": "Model optimal scenario",
        "discount_optimal_discount": "Recommended optimal discount from current price",
        "discount_error_parse": "Could not read required values. Please enter at least quantity, price, discount amount, and post-discount total quantity.",
        "privacy_link": "Privacy Policy",
        "privacy_title": "Privacy Policy",
        "privacy_intro": "PriceOptimize.ai values user privacy.",
        "privacy_section_data": "Data We Process",
        "privacy_data_text": "Data you enter in calculator forms is processed to provide calculations. Sensitive payment card details are not collected by this app.",
        "privacy_section_ads": "Ads and Cookies",
        "privacy_ads_text": "The site may use advertising services in the future. In that case, cookie and ad preference controls will be provided via related policy tools.",
        "privacy_section_contact": "Contact",
        "privacy_contact_text": "For privacy requests: admin@priceoptimize.ai",
    },
    "de": {
        "page_title": "Optimaler Preisrechner",
        "page_intro": "Findet den optimalen Preis auf Basis vergangener Nachfrage- und Preisdaten.",
        "language": "Sprache",
        "change_language": "Ändern",
        "point_1": "Datenpunkt 1",
        "point_2": "Datenpunkt 2",
        "price_1": "1. Verkaufspreis",
        "demand_1": "1. Nachfragemenge",
        "price_2": "2. Verkaufspreis",
        "demand_2": "2. Nachfragemenge",
        "currency": "Währung",
        "unit_cost": "Stückkosten",
        "calculate": "Berechnen",
        "menu_engines": "Rechner",
        "engine_price_demand_title": "Preis-Nachfrage-Rechner",
        "engine_price_demand_desc": "Erstellt aus zwei Datenpunkten ein Nachfragemodell und optimiert den Gewinn.",
        "go_to_engine": "Rechner Offnen",
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
        "portal_title": "Optimieren Sie die Preise Ihrer Produkte",
        "method": "Optimierungsmethode",
        "method_closed_form": "Geschlossene Form",
        "method_grg": "Nichtlineares GRG (iterativ)",
        "method_used": "Verwendete Methode",
        "no_profit_note": "Mit diesen Eingaben ist kein positiver Gewinn möglich. Das beste Ergebnis ist, nicht zu verkaufen (Gewinn = 0).",
        "engine_discount_title": "Rabattwirkungs-Modul",
        "engine_discount_desc": "Kalkülbasiertes Rabattmodell: findet den maximalen Gewinn mit Rabattschritt und Absatzanstieg.",
        "discount_page_title": "Absatzwirkung nach Rabatt",
        "discount_prompt_label": "Was soll berechnet werden? (Optional)",
        "discount_prompt_placeholder": "Beispiel: Gewinn maximieren oder besten Preis finden.",
        "discount_hint": "Schreiben Sie pro Zeile einen Satz. Mit + können Sie eine neue Zeile hinzufügen.",
        "discount_example": "Beispielzeilen: Ich habe 100 Stück zu 1 TL verkauft. / Nach 0,05 TL Rabatt habe ich 110 Stück verkauft.",
        "discount_fields_title": "Datensätze",
        "discount_field_name": "Satz",
        "discount_add_row": "+ Satz hinzufügen",
        "discount_remove_row": "Entfernen",
        "discount_speech_input": "Spracheingabe",
        "discount_speech_start": "Mikrofon starten",
        "discount_speech_stop": "Stoppen",
        "discount_speech_ready": "Klicken Sie auf das Mikrofon und sprechen Sie.",
        "discount_speech_listening": "Wird gehört... Bitte sprechen Sie weiter.",
        "discount_speech_not_supported": "Dieser Browser unterstützt keine Spracheingabe.",
        "discount_result_title": "Modulergebnis",
        "discount_step_model_title": "Kalkülmodell (Video-Algorithmus)",
        "discount_step_rule": "Regel",
        "discount_step_rule_value": "Bei jedem Rabatt von {step} steigt der Absatz um {extra} Stück",
        "discount_profit_function": "Gewinnfunktion",
        "discount_optimal_reductions": "Optimale Anzahl der Rabattschritte",
        "discount_optimal_price_step": "Optimaler Verkaufspreis",
        "discount_optimal_qty_step": "Optimale Verkaufsmenge",
        "discount_optimal_profit_step": "Maximaler Gewinn (Kalkülmodell)",
        "discount_input_summary": "Eingabewerte",
        "discount_base_revenue": "Umsatz vor Rabatt",
        "discount_new_revenue": "Umsatz nach Rabatt",
        "discount_base_profit": "Gewinn vor Rabatt",
        "discount_new_profit": "Gewinn nach Rabatt",
        "discount_model_profit": "Höchster Modellgewinn",
        "discount_recommendation": "Empfohlenes Szenario",
        "discount_scenario_keep": "Normalpreis beibehalten",
        "discount_scenario_discount": "Mit Rabattpreis verkaufen",
        "discount_objective": "Ziel",
        "discount_objective_profit": "Gewinnmaximierung",
        "discount_objective_revenue": "Umsatzmaximierung",
        "discount_delta": "Umsatzdifferenz",
        "discount_extra_units": "Zusätzliche Stückzahl",
        "discount_after_units": "Gesamtmenge nach Rabatt",
        "discount_after_price": "Rabattierter Preis",
        "discount_model_formula": "Nachfragemodell",
        "discount_best_price": "Empfohlener Bestpreis",
        "discount_best_demand": "Erwartete Menge beim Bestpreis",
        "discount_best_revenue": "Höchster Modellumsatz",
        "discount_all_scenarios": "Vergleich aller Szenarien",
        "discount_case_current": "Aktuelles Preisszenario",
        "discount_case_discount": "Rabattpreisszenario",
        "discount_case_optimal": "Optimales Modellszenario",
        "discount_optimal_discount": "Empfohlener optimaler Rabatt vom aktuellen Preis",
        "discount_error_parse": "Erforderliche Werte konnten nicht gelesen werden. Geben Sie mindestens Menge, Preis, Rabatt und Menge nach Rabatt ein.",
    },
    "es": {
        "page_title": "Calculadora de Precio Óptimo",
        "page_intro": "Encuentra el precio óptimo a partir de datos históricos de demanda y precio.",
        "language": "Idioma",
        "change_language": "Cambiar",
        "point_1": "Punto de Datos 1",
        "point_2": "Punto de Datos 2",
        "price_1": "1.º Precio de Venta",
        "demand_1": "1.ª Cantidad de Demanda",
        "price_2": "2.º Precio de Venta",
        "demand_2": "2.ª Cantidad de Demanda",
        "currency": "Moneda",
        "unit_cost": "Costo Unitario",
        "calculate": "Calcular",
        "menu_engines": "Motores",
        "engine_price_demand_title": "Motor Precio-Demanda",
        "engine_price_demand_desc": "Construye un modelo de demanda y optimiza la ganancia con dos puntos de datos.",
        "go_to_engine": "Abrir Motor",
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
        "portal_title": "Optimiza los precios de tus productos",
        "method": "Método de optimización",
        "method_closed_form": "Forma cerrada",
        "method_grg": "GRG no lineal (iterativo)",
        "method_used": "Método usado",
        "no_profit_note": "Con estos datos no es posible un beneficio positivo. La mejor opción es no vender (beneficio = 0).",
        "engine_discount_title": "Motor de Impacto del Descuento",
        "engine_discount_desc": "Modelo de cálculo con reducción de precio: encuentra la ganancia máxima usando paso de descuento y aumento de ventas.",
        "discount_page_title": "Impacto de Ventas Tras Descuento",
        "discount_prompt_label": "¿Qué se calculará? (Opcional)",
        "discount_prompt_placeholder": "Ejemplo: Maximizar ganancia o encontrar el mejor precio.",
        "discount_hint": "Escribe una frase por línea. Usa + para agregar una nueva línea.",
        "discount_example": "Ejemplos: Vendí 100 unidades a 1 TL. / Con un descuento de 0,05 TL vendí 110 unidades.",
        "discount_fields_title": "Frases de datos",
        "discount_field_name": "Frase",
        "discount_add_row": "+ Agregar frase",
        "discount_remove_row": "Eliminar",
        "discount_speech_input": "Entrada por voz",
        "discount_speech_start": "Iniciar micrófono",
        "discount_speech_stop": "Detener",
        "discount_speech_ready": "Haz clic en el micrófono y habla.",
        "discount_speech_listening": "Escuchando... Sigue hablando.",
        "discount_speech_not_supported": "Este navegador no admite entrada por voz.",
        "discount_result_title": "Resultado del motor",
        "discount_step_model_title": "Modelo de Cálculo (Algoritmo del video)",
        "discount_step_rule": "Regla",
        "discount_step_rule_value": "Por cada descuento de {step}, las ventas suben {extra} unidades",
        "discount_profit_function": "Función de ganancia",
        "discount_optimal_reductions": "Número óptimo de pasos de descuento",
        "discount_optimal_price_step": "Precio de venta óptimo",
        "discount_optimal_qty_step": "Cantidad óptima vendida",
        "discount_optimal_profit_step": "Ganancia máxima (modelo de cálculo)",
        "discount_input_summary": "Resumen de entrada",
        "discount_base_revenue": "Ingresos antes del descuento",
        "discount_new_revenue": "Ingresos después del descuento",
        "discount_base_profit": "Ganancia antes del descuento",
        "discount_new_profit": "Ganancia después del descuento",
        "discount_model_profit": "Máxima ganancia del modelo",
        "discount_recommendation": "Escenario recomendado",
        "discount_scenario_keep": "Mantener precio normal",
        "discount_scenario_discount": "Vender con precio descontado",
        "discount_objective": "Objetivo",
        "discount_objective_profit": "Maximización de ganancia",
        "discount_objective_revenue": "Maximización de ingresos",
        "discount_delta": "Diferencia de ingresos",
        "discount_extra_units": "Unidades extra vendidas",
        "discount_after_units": "Total de unidades tras descuento",
        "discount_after_price": "Precio con descuento",
        "discount_model_formula": "Modelo de demanda",
        "discount_best_price": "Mejor precio recomendado por el modelo",
        "discount_best_demand": "Cantidad esperada al mejor precio",
        "discount_best_revenue": "Ingreso máximo del modelo",
        "discount_all_scenarios": "Comparación de todos los escenarios",
        "discount_case_current": "Escenario de precio actual",
        "discount_case_discount": "Escenario de precio con descuento",
        "discount_case_optimal": "Escenario óptimo del modelo",
        "discount_optimal_discount": "Descuento óptimo recomendado desde el precio actual",
        "discount_error_parse": "No se pudieron leer los valores requeridos. Ingresa al menos cantidad, precio, descuento y cantidad tras descuento.",
    },
    "it": {
        "page_title": "Calcolatore Prezzo Ottimale",
        "page_intro": "Trova il prezzo ottimale in base ai dati storici di domanda e prezzo.",
        "language": "Lingua",
        "change_language": "Cambia",
        "point_1": "Punto Dati 1",
        "point_2": "Punto Dati 2",
        "price_1": "1° Prezzo di Vendita",
        "demand_1": "1ª Quantità di Domanda",
        "price_2": "2° Prezzo di Vendita",
        "demand_2": "2ª Quantità di Domanda",
        "currency": "Valuta",
        "unit_cost": "Costo Unitario",
        "calculate": "Calcola",
        "menu_engines": "Motori",
        "engine_price_demand_title": "Motore Prezzo-Domanda",
        "engine_price_demand_desc": "Costruisce un modello di domanda e ottimizza il profitto da due punti dati.",
        "go_to_engine": "Apri Motore",
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
        "portal_title": "Ottimizza i prezzi dei tuoi prodotti",
        "method": "Metodo di ottimizzazione",
        "method_closed_form": "Forma chiusa",
        "method_grg": "GRG non lineare (iterativo)",
        "method_used": "Metodo usato",
        "no_profit_note": "Con questi dati non è possibile un profitto positivo. Il risultato migliore è non vendere (profitto = 0).",
        "engine_discount_title": "Motore Impatto Sconto",
        "engine_discount_desc": "Modello di calcolo con riduzione prezzo: trova il profitto massimo usando passo di sconto e aumento vendite.",
        "discount_page_title": "Impatto Vendite Dopo Sconto",
        "discount_prompt_label": "Cosa calcolare? (Opzionale)",
        "discount_prompt_placeholder": "Esempio: Massimizza il profitto o trova il prezzo migliore.",
        "discount_hint": "Scrivi una frase per riga. Usa + per aggiungere una nuova riga.",
        "discount_example": "Esempi: Ho venduto 100 unità a 1 TL. / Con uno sconto di 0,05 TL ho venduto 110 unità.",
        "discount_fields_title": "Frasi dati",
        "discount_field_name": "Frase",
        "discount_add_row": "+ Aggiungi frase",
        "discount_remove_row": "Rimuovi",
        "discount_speech_input": "Input vocale",
        "discount_speech_start": "Avvia microfono",
        "discount_speech_stop": "Ferma",
        "discount_speech_ready": "Clicca sul microfono e parla.",
        "discount_speech_listening": "In ascolto... Continua a parlare.",
        "discount_speech_not_supported": "Questo browser non supporta l'input vocale.",
        "discount_result_title": "Risultato motore",
        "discount_step_model_title": "Modello di Calcolo (Algoritmo video)",
        "discount_step_rule": "Regola",
        "discount_step_rule_value": "Per ogni sconto di {step}, le vendite aumentano di {extra} unità",
        "discount_profit_function": "Funzione di profitto",
        "discount_optimal_reductions": "Numero ottimale di passi di sconto",
        "discount_optimal_price_step": "Prezzo di vendita ottimale",
        "discount_optimal_qty_step": "Quantità venduta ottimale",
        "discount_optimal_profit_step": "Profitto massimo (modello di calcolo)",
        "discount_input_summary": "Riepilogo input",
        "discount_base_revenue": "Ricavo prima dello sconto",
        "discount_new_revenue": "Ricavo dopo lo sconto",
        "discount_base_profit": "Profitto prima dello sconto",
        "discount_new_profit": "Profitto dopo lo sconto",
        "discount_model_profit": "Massimo profitto del modello",
        "discount_recommendation": "Scenario consigliato",
        "discount_scenario_keep": "Mantieni prezzo normale",
        "discount_scenario_discount": "Vendi con prezzo scontato",
        "discount_objective": "Obiettivo",
        "discount_objective_profit": "Massimizzazione del profitto",
        "discount_objective_revenue": "Massimizzazione del ricavo",
        "discount_delta": "Differenza ricavo",
        "discount_extra_units": "Unità extra vendute",
        "discount_after_units": "Unità totali dopo sconto",
        "discount_after_price": "Prezzo scontato",
        "discount_model_formula": "Modello di domanda",
        "discount_best_price": "Miglior prezzo consigliato dal modello",
        "discount_best_demand": "Quantità prevista al prezzo migliore",
        "discount_best_revenue": "Ricavo massimo del modello",
        "discount_all_scenarios": "Confronto di tutti gli scenari",
        "discount_case_current": "Scenario prezzo attuale",
        "discount_case_discount": "Scenario prezzo scontato",
        "discount_case_optimal": "Scenario ottimale del modello",
        "discount_optimal_discount": "Sconto ottimale consigliato dal prezzo attuale",
        "discount_error_parse": "Impossibile leggere i valori richiesti. Inserisci almeno quantità, prezzo, sconto e quantità dopo sconto.",
    },
    "ru": {
        "page_title": "Калькулятор Оптимальной Цены",
        "page_intro": "Находит оптимальную цену на основе прошлых данных о спросе и цене.",
        "language": "Язык",
        "change_language": "Изменить",
        "point_1": "Точка Данных 1",
        "point_2": "Точка Данных 2",
        "price_1": "1-я Цена Продажи",
        "demand_1": "1-е Количество Спроса",
        "price_2": "2-я Цена Продажи",
        "demand_2": "2-е Количество Спроса",
        "currency": "Валюта",
        "unit_cost": "Себестоимость за единицу",
        "calculate": "Рассчитать",
        "menu_engines": "Модули",
        "engine_price_demand_title": "Модуль Цена-Спрос",
        "engine_price_demand_desc": "Строит модель спроса по двум точкам и оптимизирует прибыль.",
        "go_to_engine": "Открыть Модуль",
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
        "portal_title": "Оптимизируйте цены ваших товаров",
        "method": "Метод оптимизации",
        "method_closed_form": "Закрытая форма",
        "method_grg": "Нелинейный GRG (итеративно)",
        "method_used": "Использованный метод",
        "no_profit_note": "С этими данными положительная прибыль невозможна. Лучший вариант — не продавать (прибыль = 0).",
        "engine_discount_title": "Модуль влияния скидки",
        "engine_discount_desc": "Калькуляционный модельный подход: находит максимум прибыли по шагу скидки и росту продаж.",
        "discount_page_title": "Эффект продаж после скидки",
        "discount_prompt_label": "Что рассчитать? (Необязательно)",
        "discount_prompt_placeholder": "Пример: Максимизировать прибыль или найти лучшую цену.",
        "discount_hint": "Пишите по одному предложению в строке. Используйте + для добавления новой строки.",
        "discount_example": "Примеры: Я продал 100 единиц по 1 TL. / После скидки 0,05 TL я продал 110 единиц.",
        "discount_fields_title": "Строки данных",
        "discount_field_name": "Предложение",
        "discount_add_row": "+ Добавить строку",
        "discount_remove_row": "Удалить",
        "discount_speech_input": "Голосовой ввод",
        "discount_speech_start": "Включить микрофон",
        "discount_speech_stop": "Остановить",
        "discount_speech_ready": "Нажмите на микрофон и говорите.",
        "discount_speech_listening": "Слушаю... Продолжайте говорить.",
        "discount_speech_not_supported": "Этот браузер не поддерживает голосовой ввод.",
        "discount_result_title": "Результат модуля",
        "discount_step_model_title": "Математическая модель (алгоритм из видео)",
        "discount_step_rule": "Правило",
        "discount_step_rule_value": "На каждый шаг скидки {step} продажи растут на {extra} единиц",
        "discount_profit_function": "Функция прибыли",
        "discount_optimal_reductions": "Оптимальное число шагов скидки",
        "discount_optimal_price_step": "Оптимальная цена продажи",
        "discount_optimal_qty_step": "Оптимальный объём продаж",
        "discount_optimal_profit_step": "Максимальная прибыль (модель)",
        "discount_input_summary": "Сводка входных данных",
        "discount_base_revenue": "Выручка до скидки",
        "discount_new_revenue": "Выручка после скидки",
        "discount_base_profit": "Прибыль до скидки",
        "discount_new_profit": "Прибыль после скидки",
        "discount_model_profit": "Максимальная прибыль модели",
        "discount_recommendation": "Рекомендуемый сценарий",
        "discount_scenario_keep": "Оставить обычную цену",
        "discount_scenario_discount": "Продавать со скидкой",
        "discount_objective": "Цель",
        "discount_objective_profit": "Максимизация прибыли",
        "discount_objective_revenue": "Максимизация выручки",
        "discount_delta": "Разница выручки",
        "discount_extra_units": "Дополнительные проданные единицы",
        "discount_after_units": "Общее количество после скидки",
        "discount_after_price": "Цена со скидкой",
        "discount_model_formula": "Модель спроса",
        "discount_best_price": "Лучшая цена по модели",
        "discount_best_demand": "Ожидаемый объём по лучшей цене",
        "discount_best_revenue": "Максимальная выручка модели",
        "discount_all_scenarios": "Сравнение всех сценариев",
        "discount_case_current": "Сценарий текущей цены",
        "discount_case_discount": "Сценарий цены со скидкой",
        "discount_case_optimal": "Оптимальный сценарий модели",
        "discount_optimal_discount": "Рекомендуемая оптимальная скидка от текущей цены",
        "discount_error_parse": "Не удалось прочитать обязательные значения. Укажите минимум: количество, цену, скидку и количество после скидки.",
    },
    "fr": {
        "page_title": "Calculateur de Prix Optimal",
        "page_intro": "Trouve le prix optimal a partir des donnees historiques de demande et de prix.",
        "language": "Langue",
        "change_language": "Changer",
        "point_1": "Point de Données 1",
        "point_2": "Point de Données 2",
        "price_1": "1er Prix de Vente",
        "demand_1": "1re Quantite de Demande",
        "price_2": "2e Prix de Vente",
        "demand_2": "2e Quantite de Demande",
        "currency": "Devise",
        "unit_cost": "Cout Unitaire",
        "calculate": "Calculer",
        "menu_engines": "Moteurs",
        "engine_price_demand_title": "Moteur Prix-Demande",
        "engine_price_demand_desc": "Cree un modele de demande a partir de deux points et optimise le profit.",
        "go_to_engine": "Ouvrir le Moteur",
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
        "portal_title": "Optimisez les prix de vos produits",
        "method": "Méthode d'optimisation",
        "method_closed_form": "Forme fermée",
        "method_grg": "GRG non linéaire (itératif)",
        "method_used": "Méthode utilisée",
        "no_profit_note": "Avec ces données, un profit positif n'est pas possible. Le meilleur résultat est de ne pas vendre (profit = 0).",
        "engine_discount_title": "Moteur d'impact de réduction",
        "engine_discount_desc": "Modèle de calcul basé sur la réduction de prix : trouve le profit maximal avec pas de réduction et hausse des ventes.",
        "discount_page_title": "Impact des ventes après réduction",
        "discount_prompt_label": "Que faut-il calculer ? (Optionnel)",
        "discount_prompt_placeholder": "Exemple : Maximiser le profit ou trouver le meilleur prix.",
        "discount_hint": "Écrivez une phrase par ligne. Utilisez + pour ajouter une nouvelle ligne.",
        "discount_example": "Exemples : J'ai vendu 100 unités à 1 TL. / Après une réduction de 0,05 TL, j'ai vendu 110 unités.",
        "discount_fields_title": "Phrases de données",
        "discount_field_name": "Phrase",
        "discount_add_row": "+ Ajouter une phrase",
        "discount_remove_row": "Supprimer",
        "discount_speech_input": "Saisie vocale",
        "discount_speech_start": "Démarrer le micro",
        "discount_speech_stop": "Arrêter",
        "discount_speech_ready": "Cliquez sur le micro et parlez.",
        "discount_speech_listening": "Écoute... Continuez à parler.",
        "discount_speech_not_supported": "Ce navigateur ne prend pas en charge la saisie vocale.",
        "discount_result_title": "Résultat du moteur",
        "discount_step_model_title": "Modèle de calcul (algorithme vidéo)",
        "discount_step_rule": "Règle",
        "discount_step_rule_value": "Pour chaque réduction de {step}, les ventes augmentent de {extra} unités",
        "discount_profit_function": "Fonction de profit",
        "discount_optimal_reductions": "Nombre optimal de pas de réduction",
        "discount_optimal_price_step": "Prix de vente optimal",
        "discount_optimal_qty_step": "Quantité vendue optimale",
        "discount_optimal_profit_step": "Profit maximal (modèle de calcul)",
        "discount_input_summary": "Résumé des entrées",
        "discount_base_revenue": "Revenu avant réduction",
        "discount_new_revenue": "Revenu après réduction",
        "discount_base_profit": "Profit avant réduction",
        "discount_new_profit": "Profit après réduction",
        "discount_model_profit": "Profit maximal du modèle",
        "discount_recommendation": "Scénario recommandé",
        "discount_scenario_keep": "Conserver le prix normal",
        "discount_scenario_discount": "Vendre avec prix réduit",
        "discount_objective": "Objectif",
        "discount_objective_profit": "Maximisation du profit",
        "discount_objective_revenue": "Maximisation du revenu",
        "discount_delta": "Écart de revenu",
        "discount_extra_units": "Unités supplémentaires vendues",
        "discount_after_units": "Total unités après réduction",
        "discount_after_price": "Prix réduit",
        "discount_model_formula": "Modèle de demande",
        "discount_best_price": "Meilleur prix recommandé par le modèle",
        "discount_best_demand": "Quantité attendue au meilleur prix",
        "discount_best_revenue": "Revenu maximal du modèle",
        "discount_all_scenarios": "Comparaison de tous les scénarios",
        "discount_case_current": "Scénario prix actuel",
        "discount_case_discount": "Scénario prix réduit",
        "discount_case_optimal": "Scénario optimal du modèle",
        "discount_optimal_discount": "Réduction optimale recommandée depuis le prix actuel",
        "discount_error_parse": "Impossible de lire les valeurs requises. Saisissez au minimum quantité, prix, réduction et quantité après réduction.",
    },
}


def _localized_engines(labels: dict) -> list[dict]:
    return [
        {
            "title": labels["engine_price_demand_title"],
            "description": labels["engine_price_demand_desc"],
            "path": "/price-demand/",
            "enabled": True,
        },
        {
            "title": labels["engine_discount_title"],
            "description": labels["engine_discount_desc"],
            "path": "/price-demand/discount-optimizer/",
            "enabled": True,
        },
    ]


def _extract_decimal_by_patterns(text: str, patterns: list[str]) -> Decimal | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            try:
                return _to_decimal(match.group(1))
            except InvalidOperation:
                continue
    return None


def _parse_discount_prompt(prompt: str) -> dict[str, Decimal] | None:
    text = prompt.lower()
    qty_matches = re.findall(r"([-+]?\d+(?:[.,]\d+)?)\s*(?:adet|unit|units?)", text, flags=re.IGNORECASE)
    qty = None
    if qty_matches:
        qty = _to_decimal(qty_matches[0])

    if qty is None:
        qty = _extract_decimal_by_patterns(
            text,
            [
                r"(?:urun adedi|ürün adedi|adet|miktar|quantity)\D{0,24}([-+]?\d+(?:[.,]\d+)?)",
            ],
        )

    price = _extract_decimal_by_patterns(
        text,
        [
            r"([-+]?\d+(?:[.,]\d+)?)\s*(?:tl|try|usd|eur|\$|€|₺)\s*(?:den|dan|from)?",
            r"(?:urun fiyati|ürün fiyatı|fiyat|price)\D{0,24}([-+]?\d+(?:[.,]\d+)?)",
        ],
    )
    discount = _extract_decimal_by_patterns(
        text,
        [
            r"([-+]?\d+(?:[.,]\d+)?)\s*(?:tl|try|usd|eur|\$|€|₺)?\s*(?:indirim bedeli|indirim|discount)",
            r"(?:indirim bedeli|indirim|discount)\D{0,12}([-+]?\d+(?:[.,]\d+)?)",
        ],
    )

    extra = _extract_decimal_by_patterns(
        text,
        [
            r"(?:fazla sat|ek sat|arti[sş]|artis|additional|extra)\D{0,30}([-+]?\d+(?:[.,]\d+)?)",
        ],
    )

    explicit_after_qty = _extract_decimal_by_patterns(
        text,
        [
            r"(?:indirim yapinca|indirimden sonra|after discount)[^.\n]{0,50}\b([-+]?\d+(?:[.,]\d+)?)\s*(?:adet|unit|units?)",
            r"(?:sattim|sold)\D{0,18}([-+]?\d+(?:[.,]\d+)?)\s*(?:adet|unit|units?)",
        ],
    )
    after_qty = explicit_after_qty
    if after_qty is None and len(qty_matches) >= 2 and "her" not in text:
        after_qty = _to_decimal(qty_matches[1])

    if None in (qty, price, discount) or (extra is None and after_qty is None):
        numbers = re.findall(r"[-+]?\d+(?:[.,]\d+)?", text)
        if len(numbers) >= 4:
            try:
                qty = qty or _to_decimal(numbers[0])
                price = price or _to_decimal(numbers[1])
                discount = discount or _to_decimal(numbers[2])
                if after_qty is None and extra is None:
                    after_qty = _to_decimal(numbers[3])
            except InvalidOperation:
                return None

    if None in (qty, price, discount) or (extra is None and after_qty is None):
        return None

    if after_qty is None and extra is not None:
        after_qty = qty + extra
    if extra is None and after_qty is not None:
        extra = after_qty - qty

    if after_qty is None or extra is None:
        return None

    unit_cost = _extract_decimal_by_patterns(
        text,
        [
            r"(?:birim maliyet|maliyet|unit cost|cost)\D{0,12}([-+]?\d+(?:[.,]\d+)?)",
        ],
    )

    reduction_step = None
    extra_per_reduction = None
    step_patterns = [
        r"her\D{0,8}([-+]?\d+(?:[.,]\d+)?)\s*(?:tl|try|usd|eur|₺|\$|€)?\D{0,12}(?:indirim|dus|düş|price reduction|decrease)[^.\n]{0,50}?([-+]?\d+(?:[.,]\d+)?)\s*(?:adet|unit|units?)",
        r"([-+]?\d+(?:[.,]\d+)?)\s*(?:adet|unit|units?)\D{0,24}(?:fazla|art|increase|more)[^.\n]{0,50}?her\D{0,8}([-+]?\d+(?:[.,]\d+)?)\s*(?:tl|try|usd|eur|₺|\$|€)?\D{0,12}(?:indirim|dus|düş|price reduction|decrease)",
    ]
    for idx, pattern in enumerate(step_patterns):
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue
        try:
            if idx == 0:
                reduction_step = _to_decimal(match.group(1))
                extra_per_reduction = _to_decimal(match.group(2))
            else:
                extra_per_reduction = _to_decimal(match.group(1))
                reduction_step = _to_decimal(match.group(2))
            break
        except InvalidOperation:
            reduction_step = None
            extra_per_reduction = None

    if (
        reduction_step is not None
        and extra_per_reduction is not None
        and reduction_step > 0
        and extra_per_reduction > 0
        and explicit_after_qty is None
    ):
        discount = reduction_step
        extra = extra_per_reduction
        after_qty = qty + extra

    return {
        "qty": qty,
        "price": price,
        "discount": discount,
        "extra": extra,
        "after_qty": after_qty,
        "unit_cost": unit_cost if unit_cost is not None else Decimal("0"),
        "reduction_step": reduction_step,
        "extra_per_reduction": extra_per_reduction,
    }


def _normalize_field_name(name: str) -> str:
    text = (name or "").strip().lower()
    replacements = {
        "ü": "u",
        "ğ": "g",
        "ş": "s",
        "ı": "i",
        "ö": "o",
        "ç": "c",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return " ".join(text.split())


def _parse_discount_fields(post_data) -> dict[str, Decimal] | None:
    names = post_data.getlist("field_name[]")
    values = post_data.getlist("field_value[]")
    parsed_values: dict[str, Decimal] = {}
    base_prices: list[Decimal] = []
    discount_prices: list[Decimal] = []
    generic_prices: list[Decimal] = []
    base_qtys: list[Decimal] = []
    after_qtys: list[Decimal] = []
    generic_qtys: list[Decimal] = []
    discount_amounts: list[Decimal] = []

    for raw_name, raw_value in zip(names, values):
        name = _normalize_field_name(raw_name)
        value_text = (raw_value or "").strip()
        if not name or not value_text:
            continue
        try:
            value = _to_decimal(value_text)
        except InvalidOperation:
            continue

        if name in {"birim maliyet", "maliyet", "unit cost", "cost"}:
            parsed_values["unit_cost"] = value
            continue

        has_price = any(token in name for token in ["fiyat", "price", "ucret"])
        has_qty = any(token in name for token in ["adet", "quantity", "units", "miktar", "satis"])
        has_discount = any(token in name for token in ["indirim", "discount"])
        has_after = any(token in name for token in ["sonrasi", "after", "yeni"])
        has_base = any(token in name for token in ["normal", "once", "before", "ilk", "mevcut"])

        if has_price:
            if has_discount or has_after:
                discount_prices.append(value)
            elif has_base:
                base_prices.append(value)
            else:
                generic_prices.append(value)
            continue

        if has_qty:
            if has_discount or has_after:
                after_qtys.append(value)
            elif has_base:
                base_qtys.append(value)
            else:
                generic_qtys.append(value)
            continue

        if has_discount:
            discount_amounts.append(value)

    if base_prices:
        parsed_values["price"] = base_prices[0]
    elif len(generic_prices) >= 2:
        sorted_prices = sorted(generic_prices, reverse=True)
        parsed_values["price"] = sorted_prices[0]
        parsed_values["discounted_price"] = sorted_prices[-1]
    elif len(generic_prices) == 1:
        parsed_values["price"] = generic_prices[0]

    if discount_prices:
        parsed_values["discounted_price"] = discount_prices[0]
    elif "discounted_price" not in parsed_values and "price" in parsed_values and discount_amounts:
        parsed_values["discounted_price"] = parsed_values["price"] - discount_amounts[0]

    if "price" in parsed_values and "discounted_price" in parsed_values:
        parsed_values["discount"] = parsed_values["price"] - parsed_values["discounted_price"]
    elif discount_amounts:
        parsed_values["discount"] = discount_amounts[0]

    if base_qtys:
        parsed_values["qty"] = base_qtys[0]
    elif len(generic_qtys) >= 2:
        sorted_qtys = sorted(generic_qtys)
        parsed_values["qty"] = sorted_qtys[0]
        parsed_values["after_qty"] = sorted_qtys[-1]
    elif len(generic_qtys) == 1:
        parsed_values["qty"] = generic_qtys[0]

    if after_qtys:
        parsed_values["after_qty"] = after_qtys[0]

    if "qty" not in parsed_values or "price" not in parsed_values or "discount" not in parsed_values:
        return None
    if "after_qty" not in parsed_values and "extra" not in parsed_values:
        return None
    if "after_qty" not in parsed_values:
        parsed_values["after_qty"] = parsed_values["qty"] + parsed_values["extra"]
    if "extra" not in parsed_values:
        parsed_values["extra"] = parsed_values["after_qty"] - parsed_values["qty"]

    return parsed_values


def _detect_objective(goal_text: str) -> str:
    text = _normalize_field_name(goal_text)
    profit_words = ["kar", "profit", "maksimum kar", "max profit"]
    for word in profit_words:
        if word in text:
            return "profit"
    return "revenue"


def _to_decimal(value: str) -> Decimal:
    return Decimal(str(value).replace(",", ".").strip())


def _build_chart_data(
    a: Decimal,
    b: Decimal,
    unit_cost: Decimal,
    p1: Decimal,
    q1: Decimal,
    p2: Decimal,
    q2: Decimal,
    p_opt: Decimal,
):
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

    def profit(price: float) -> float:
        demand = float(a) + float(b) * price
        return (price - float(unit_cost)) * demand

    raw_points = []
    for i in range(60):
        x = x_min + ((x_max - x_min) * i / 59)
        y = profit(x)
        if isfinite(y):
            raw_points.append((x, y))

    if not raw_points:
        return None

    y_values = [point[1] for point in raw_points]
    y_values.extend(
        [
            float((p1 - unit_cost) * q1),
            float((p2 - unit_cost) * q2),
            float((p_opt - unit_cost) * (a + b * p_opt)),
        ]
    )
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
    p1y = float((p1 - unit_cost) * q1)
    p2y = float((p2 - unit_cost) * q2)
    opy = float((p_opt - unit_cost) * (a + b * p_opt))

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


def _profit_value(price: Decimal, a: Decimal, b: Decimal, unit_cost: Decimal) -> Decimal:
    demand = max(a + (b * price), Decimal("0"))
    return (price - unit_cost) * demand


def _grg_optimal_price(a: Decimal, b: Decimal, unit_cost: Decimal, p1: Decimal, p2: Decimal) -> Decimal:
    if b == 0:
        return Decimal("0")

    base = max(abs(p1), abs(p2), abs(unit_cost), Decimal("1"))
    upper = max(p1, p2, unit_cost, Decimal("0")) + (base * Decimal("4"))
    if b < 0 and a > 0:
        demand_zero = -(a / b)
        if demand_zero > 0:
            upper = min(upper, demand_zero)
    if upper <= 0:
        upper = Decimal("100")

    x = max((p1 + p2) / Decimal("2"), Decimal("0"))
    x = min(x, upper)
    eps = Decimal("0.0001")
    lr = Decimal("0.15")

    for i in range(120):
        h = max(Decimal("0.001"), x.copy_abs() * Decimal("0.001"))
        x_plus = min(x + h, upper)
        x_minus = max(x - h, Decimal("0"))

        f_plus = _profit_value(x_plus, a, b, unit_cost)
        f_minus = _profit_value(x_minus, a, b, unit_cost)
        grad = (f_plus - f_minus) / (x_plus - x_minus if x_plus != x_minus else Decimal("1"))

        step = (lr / Decimal(1 + (i * 0.05))) * grad
        candidate = x + step
        candidate = min(max(candidate, Decimal("0")), upper)

        current_val = _profit_value(x, a, b, unit_cost)
        candidate_val = _profit_value(candidate, a, b, unit_cost)
        backtrack = 0
        while candidate_val < current_val and backtrack < 8:
            step /= Decimal("2")
            candidate = x + step
            candidate = min(max(candidate, Decimal("0")), upper)
            candidate_val = _profit_value(candidate, a, b, unit_cost)
            backtrack += 1

        if abs(candidate - x) < eps:
            x = candidate
            break
        x = candidate

    return x


def _select_best_price(candidates: list[Decimal], a: Decimal, b: Decimal, unit_cost: Decimal) -> tuple[Decimal, Decimal]:
    best_price = Decimal("0")
    best_profit = None
    for candidate in candidates:
        if candidate < 0:
            continue
        value = _profit_value(candidate, a, b, unit_cost)
        if best_profit is None or value > best_profit:
            best_profit = value
            best_price = candidate
    if best_profit is None:
        return Decimal("0"), Decimal("0")
    return best_price, best_profit


def home(request):
    current_language = (get_language() or "tr").split("-")[0]
    labels = {**TEXTS["en"], **TEXTS.get(current_language, TEXTS["en"])}
    engines = _localized_engines(labels)
    selected_currency = request.POST.get("currency", "TRY")
    selected_method = request.POST.get("method", "closed_form")
    method_options = [
        {"code": "closed_form", "label": labels["method_closed_form"]},
        {"code": "grg_nonlinear", "label": labels["method_grg"]},
    ]
    context = {
        "labels": labels,
        "engines": engines,
        "current_language": current_language,
        "language_options": LANGUAGE_OPTIONS,
        "method_options": method_options,
        "selected_method": selected_method,
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
        unit_cost = _to_decimal(request.POST.get("unit_cost", ""))
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

    if selected_method == "grg_nonlinear":
        raw_optimal = _grg_optimal_price(a, b, unit_cost, p1, p2)
    else:
        raw_optimal = -(a / (2 * b))

    candidates = [raw_optimal, Decimal("0"), unit_cost, p1, p2]
    if b < 0:
        choke_price = -(a / b)
        if choke_price >= 0:
            candidates.append(choke_price)
    optimal_price, max_profit = _select_best_price(candidates, a, b, unit_cost)
    expected_demand = max(a + (b * optimal_price), Decimal("0"))
    no_profit_zone = max_profit <= 0

    def round2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    context["result"] = {
        "a": round2(a),
        "b": round2(b),
        "unit_cost": round2(unit_cost),
        "method": selected_method,
        "optimal_price": round2(optimal_price),
        "expected_demand": round2(expected_demand),
        "max_profit": round2(max_profit),
        "no_profit_zone": no_profit_zone,
    }
    context["inputs"] = {
        "price_1": p1,
        "demand_1": q1,
        "price_2": p2,
        "demand_2": q2,
        "unit_cost": unit_cost,
    }
    context["chart"] = _build_chart_data(a, b, unit_cost, p1, q1, p2, q2, optimal_price)
    return render(request, "core/home.html", context)


def portal(request):
    current_language = (get_language() or "tr").split("-")[0]
    labels = {**TEXTS["en"], **TEXTS.get(current_language, TEXTS["en"])}
    engines = _localized_engines(labels)
    return render(
        request,
        "core/portal.html",
        {
            "engines": engines,
            "labels": labels,
            "current_language": current_language,
            "language_options": LANGUAGE_OPTIONS,
        },
    )


def privacy_policy(request):
    current_language = (get_language() or "tr").split("-")[0]
    labels = {**TEXTS["en"], **TEXTS.get(current_language, TEXTS["en"])}
    return render(
        request,
        "core/privacy.html",
        {
            "labels": labels,
            "current_language": current_language,
        },
    )


def ads_txt(request):
    line = os.getenv("ADS_TXT_LINE", "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0")
    return HttpResponse(f"{line}\n", content_type="text/plain; charset=utf-8")


def sitemap_xml(request):
    base = "https://www.priceoptimize.ai"
    urls = [
        base + reverse("portal"),
        base + reverse("home"),
        base + reverse("discount_optimizer"),
        base + reverse("privacy_policy"),
    ]
    lastmod = timezone.now().date().isoformat()
    body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url in urls:
        body.append("<url>")
        body.append(f"<loc>{url}</loc>")
        body.append(f"<lastmod>{lastmod}</lastmod>")
        body.append("<changefreq>weekly</changefreq>")
        body.append("<priority>0.8</priority>")
        body.append("</url>")
    body.append("</urlset>")
    return HttpResponse("\n".join(body), content_type="application/xml; charset=utf-8")


def robots_txt(request):
    content = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Sitemap: https://www.priceoptimize.ai/sitemap.xml",
            "",
        ]
    )
    return HttpResponse(content, content_type="text/plain; charset=utf-8")


def discount_optimizer(request):
    current_language = (get_language() or "tr").split("-")[0]
    labels = {**TEXTS["en"], **TEXTS.get(current_language, TEXTS["en"])}
    engines = _localized_engines(labels)
    selected_currency = request.POST.get("currency", "TRY")
    prompt_text = request.POST.get("goal_text", "")
    sentence_rows = request.POST.getlist("sentence_line[]")
    if not sentence_rows:
        sentence_rows = [""]

    context = {
        "labels": labels,
        "engines": engines,
        "current_language": current_language,
        "language_options": LANGUAGE_OPTIONS,
        "currencies": CURRENCIES,
        "selected_currency": selected_currency,
        "selected_symbol": CURRENCIES.get(selected_currency, "₺"),
        "prompt_text": prompt_text,
        "sentence_rows": sentence_rows,
    }

    if request.method != "POST":
        return render(request, "core/discount_optimizer.html", context)

    combined_text = ". ".join([row.strip() for row in sentence_rows if row.strip()])
    parsed = _parse_discount_prompt(combined_text)
    if not parsed:
        context["error"] = labels["discount_error_parse"]
        return render(request, "core/discount_optimizer.html", context)

    qty = parsed["qty"]
    price = parsed["price"]
    discount = parsed["discount"]
    extra = parsed["extra"]
    after_qty = parsed["after_qty"]
    unit_cost = max(parsed.get("unit_cost", Decimal("0")), Decimal("0"))
    discounted_price = price - discount

    if qty <= 0 or price <= 0 or discounted_price <= 0 or after_qty <= 0 or discount < 0:
        context["error"] = labels["discount_error_parse"]
        return render(request, "core/discount_optimizer.html", context)

    def round2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    objective = _detect_objective(prompt_text)
    before_revenue = price * qty
    after_revenue = discounted_price * after_qty
    before_profit = (price - unit_cost) * qty
    after_profit = (discounted_price - unit_cost) * after_qty
    delta = after_revenue - before_revenue

    if objective == "profit":
        use_discount = after_profit > before_profit
    else:
        use_discount = after_revenue > before_revenue

    step_model = None
    reduction_step = parsed.get("reduction_step")
    extra_per_reduction = parsed.get("extra_per_reduction")
    if reduction_step is None and discount > 0:
        reduction_step = discount
    if extra_per_reduction is None and extra > 0:
        extra_per_reduction = extra
    if (
        reduction_step is not None
        and extra_per_reduction is not None
        and reduction_step > 0
        and extra_per_reduction > 0
    ):
        # Video modeli:
        # p(x) = P0 - d*x
        # q(x) = Q0 + k*x
        # R(x) = p(x)*q(x)
        # C(x) = c*q(x)
        # P(x) = R(x)-C(x)
        p0 = price
        q0 = qty
        d = reduction_step
        k = extra_per_reduction
        c = unit_cost
        r_a = -(d * k)
        r_b = (p0 * k) - (d * q0)
        r_c = p0 * q0

        c_a = Decimal("0")
        c_b = c * k
        c_c = c * q0

        p_a = r_a - c_a
        p_b = r_b - c_b
        p_c = r_c - c_c

        d1_a = p_a * Decimal("2")
        d1_b = p_b
        d2_const = d1_a

        if p_a != 0:
            x_cont = -(p_b / (Decimal("2") * p_a))
        else:
            x_cont = Decimal("0")
        max_steps_by_price = p0 / d
        if max_steps_by_price < 0:
            max_steps_by_price = Decimal("0")
        x_cont = max(Decimal("0"), min(x_cont, max_steps_by_price))

        floor_x = Decimal(int(x_cont))
        ceil_x = floor_x if floor_x == x_cont else floor_x + Decimal("1")
        candidates_x = [Decimal("0"), floor_x, ceil_x, max_steps_by_price]
        best_x = Decimal("0")
        best_profit_step = None
        for x in candidates_x:
            x = max(Decimal("0"), min(x, max_steps_by_price))
            p = p0 - (d * x)
            q = q0 + (k * x)
            pi = (p - c) * q
            if best_profit_step is None or pi > best_profit_step:
                best_profit_step = pi
                best_x = x
        step_price = p0 - (d * best_x)
        step_qty = q0 + (k * best_x)
        step_profit = (step_price - c) * step_qty

        def fmt(v: Decimal) -> str:
            return str(round2(v))

        p_func = f"p(x) = {fmt(p0)} - {fmt(d)}x"
        q_func = f"q(x) = {fmt(q0)} + {fmt(k)}x"
        r_func = f"R(x) = ({fmt(p0)} - {fmt(d)}x)({fmt(q0)} + {fmt(k)}x) = {fmt(r_a)}x^2 + {fmt(r_b)}x + {fmt(r_c)}"
        c_func = f"C(x) = {fmt(c)}({fmt(q0)} + {fmt(k)}x) = {fmt(c_b)}x + {fmt(c_c)}"
        p_func_expanded = f"P(x) = {fmt(p_a)}x^2 + {fmt(p_b)}x + {fmt(p_c)}"
        d1_func = f"P'(x) = {fmt(d1_a)}x + {fmt(d1_b)}"
        d2_func = f"P''(x) = {fmt(d2_const)}"

        step_model = {
            "step": round2(d),
            "extra": round2(k),
            "x_cont": round2(x_cont),
            "x_best": round2(best_x),
            "price": round2(step_price),
            "qty": round2(step_qty),
            "profit": round2(step_profit),
            "p_func": p_func,
            "q_func": q_func,
            "r_func": r_func,
            "c_func": c_func,
            "p_func_expanded": p_func_expanded,
            "d1_func": d1_func,
            "d2_func": d2_func,
            "is_maximum": d2_const < 0,
        }

    delta_price = discounted_price - price
    b = Decimal("0")
    a = qty
    if delta_price != 0:
        b = (after_qty - qty) / delta_price
        a = qty - (b * price)
    model_optimal_price = Decimal("0")
    model_optimal_qty = Decimal("0")
    model_optimal_revenue = Decimal("0")
    model_optimal_profit = Decimal("0")
    demand_formula = None
    if b != 0:
        if objective == "profit":
            model_optimal_price = max(((b * unit_cost) - a) / (2 * b), Decimal("0"))
        else:
            model_optimal_price = max(-(a / (2 * b)), Decimal("0"))
        model_optimal_qty = max(a + (b * model_optimal_price), Decimal("0"))
        model_optimal_revenue = model_optimal_price * model_optimal_qty
        model_optimal_profit = (model_optimal_price - unit_cost) * model_optimal_qty
        demand_formula = f"Q = {a.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)} + ({b.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)}) * P"

    scenarios = [
        {
            "name": labels["discount_case_current"],
            "price": price,
            "qty": qty,
            "revenue": before_revenue,
            "profit": before_profit,
        },
        {
            "name": labels["discount_case_discount"],
            "price": discounted_price,
            "qty": after_qty,
            "revenue": after_revenue,
            "profit": after_profit,
        },
    ]
    if demand_formula is not None:
        scenarios.append(
            {
                "name": labels["discount_case_optimal"],
                "price": model_optimal_price,
                "qty": model_optimal_qty,
                "revenue": model_optimal_revenue,
                "profit": model_optimal_profit,
            }
        )

    metric_key = "profit" if objective == "profit" else "revenue"
    best_scenario = max(scenarios, key=lambda item: item[metric_key])

    context["result"] = {
        "qty": round2(qty),
        "price": round2(price),
        "discount": round2(discount),
        "discounted_price": round2(discounted_price),
        "unit_cost": round2(unit_cost),
        "extra": round2(extra),
        "after_qty": round2(after_qty),
        "before_revenue": round2(before_revenue),
        "after_revenue": round2(after_revenue),
        "before_profit": round2(before_profit),
        "after_profit": round2(after_profit),
        "delta": round2(delta),
        "use_discount": use_discount,
        "objective": objective,
        "demand_formula": demand_formula,
        "model_optimal_price": round2(model_optimal_price),
        "model_optimal_qty": round2(model_optimal_qty),
        "model_optimal_revenue": round2(model_optimal_revenue),
        "model_optimal_profit": round2(model_optimal_profit),
        "optimal_discount_from_current": round2(max(price - model_optimal_price, Decimal("0"))),
        "scenarios": [
            {
                "name": scenario["name"],
                "price": round2(scenario["price"]),
                "qty": round2(scenario["qty"]),
                "revenue": round2(scenario["revenue"]),
                "profit": round2(scenario["profit"]),
            }
            for scenario in scenarios
        ],
        "best_scenario_name": best_scenario["name"],
        "best_metric": metric_key,
        "step_model": step_model,
    }
    return render(request, "core/discount_optimizer.html", context)
