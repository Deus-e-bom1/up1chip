const { publicStatus, skaleRequest } = require("../lib/skale");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const { nome, cpf, email, telefone, valor, descricao, external_id_client } = req.body || {};
  const document = String(cpf || "").replace(/\D/g, "");
  const amount = Math.round(Number(valor) * 100);
  if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "")) ||
      document.length !== 11 || !Number.isFinite(amount) || amount < 500 || amount > 60000) {
    return res.status(400).json({ error: "Dados de pagamento inválidos." });
  }

  try {
    const transaction = await skaleRequest("/transactions", {
      method: "POST",
      body: JSON.stringify({
        amount,
        paymentMethod: "pix",
        pix: { expiresInDays: 1 },
        customer: {
          name: String(nome),
          email: String(email),
          phone: String(telefone || ""),
          document: { number: document, type: "cpf" },
        },
        items: [{
          title: String(descricao || "Pedido").slice(0, 120),
          unitPrice: amount,
          quantity: 1,
          tangible: true,
          externalRef: String(external_id_client || "").slice(0, 120),
        }],
        metadata: { external_id_client: String(external_id_client || "").slice(0, 120) },
      }),
    });

    if (!transaction.id || !transaction.pix?.qrcode) {
      return res.status(502).json({ error: "A Skale não retornou os dados do PIX." });
    }
    return res.status(200).json({
      transactionId: transaction.id,
      qrcode: transaction.pix.qrcode,
      qrcodeImage: transaction.pix.qrcodeImage || null,
      status: publicStatus(transaction.status),
    });
  } catch (error) {
    console.error("Skale create transaction failed:", error.status || "server_error");
    return res.status(error.status === 400 ? 400 : 502).json({
      error: error.status === 400 ? "A Skale recusou os dados enviados." : "Não foi possível gerar o PIX. Tente novamente.",
    });
  }
};
