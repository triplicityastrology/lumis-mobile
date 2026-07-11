import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { PRODUCT_TERMS, PERSONA_STYLES, PRODUCTS, ROUTE_CREDITS } from "@lumis/shared";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandMark}>
          <Text style={styles.brandGlyph}>☉</Text>
        </View>
        <Text style={styles.eyebrow}>Not just a horoscope.</Text>
        <Text style={styles.title}>Meet {PRODUCT_TERMS.appName}, your inner universe.</Text>
        <Text style={styles.body}>
          {PRODUCT_TERMS.appName} is a private AI space shaped by your birth chart.
        </Text>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{PRODUCT_TERMS.persona}</Text>
          {PERSONA_STYLES.map((style) => (
            <View key={style.key} style={styles.row}>
              <Text style={styles.rowTitle}>{style.labelEn}</Text>
              <Text style={styles.rowText}>{style.labelZh}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Plans</Text>
          {PRODUCTS.map((product) => (
            <View key={product.code} style={styles.row}>
              <Text style={styles.rowTitle}>{product.name}</Text>
              <Text style={styles.rowText}>
                HK${product.priceHkd} · {product.credits} {PRODUCT_TERMS.credits}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Credit Costs</Text>
          {ROUTE_CREDITS.map((route) => (
            <View key={route.route} style={styles.row}>
              <Text style={styles.rowTitle}>{route.label}</Text>
              <Text style={styles.rowText}>
                {route.credits} {PRODUCT_TERMS.credits}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B1930"
  },
  content: {
    padding: 24,
    gap: 18
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#152943",
    borderWidth: 1,
    borderColor: "rgba(232,240,255,0.18)"
  },
  brandGlyph: {
    color: "#C9A96E",
    fontSize: 36
  },
  eyebrow: {
    color: "#C9A96E",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: "#F7F0E3",
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "700"
  },
  body: {
    color: "#C7D2EA",
    fontSize: 16,
    lineHeight: 24
  },
  panel: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(247,240,227,0.06)",
    borderWidth: 1,
    borderColor: "rgba(232,240,255,0.12)"
  },
  panelTitle: {
    color: "#F7F0E3",
    fontSize: 18,
    fontWeight: "700"
  },
  row: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(232,240,255,0.10)"
  },
  rowTitle: {
    color: "#F7F0E3",
    fontSize: 15,
    fontWeight: "700"
  },
  rowText: {
    color: "#C7D2EA",
    fontSize: 13,
    marginTop: 3
  }
});

