const express = require("express");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const app = express();
const PORT = 3000;

async function getProductListHtml(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  
  const productHtml = await page.$$eval('[data-product-type="list"]', (elements) => {
    return elements.map(el => el.outerHTML);
  });
  
  await browser.close();
  return productHtml;
}

function extractProductData(html) {
  const $ = cheerio.load(html);
  
  const productId = $('[data-product-type="list"]').attr('data-product-id');
  const productName = $('.js-item-name').text().trim();
  const productUrl = $('.item-link').attr('href');
  
  let imgSrc = $('.js-product-item-image-private.product-item-image-featured').attr('srcset');
  if (!imgSrc || imgSrc.includes('base64')) {
    imgSrc = $('.js-product-item-image-private.product-item-image-featured').attr('data-srcset');
  }
  const imageSrc = imgSrc ? imgSrc.split(' ')[0].replace('//', 'https://') : '';
  
  const priceText = $('.js-price-display').text().trim();
  const priceNumber = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));
  const newPrice = priceNumber * 1.35;
  const price = `$${newPrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const hasPromo = $('.js-promotion-label-private').length > 0;
  const promoText = hasPromo ? $('.js-promotion-label-private span').text().trim() : '';
  
  const variants = [];
  $('.js-insta-variant').each((i, el) => {
    variants.push($(el).attr('data-option'));
  });
  
  return {
    productId,
    productName,
    productUrl,
    imageSrc,
    price,
    hasPromo,
    promoText,
    variants
  };
}

function generateProductCard(product) {
  const variantsHtml = product.variants.map(v => 
    `<span class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">${v}</span>`
  ).join('');
  
  // Ambos botones: Comprar directo por WhatsApp y Agregar al carrito
  const whatsappMessage = `Hola! Quisiera comprar el producto ${product.productName} ${product.price}. ¿Puede enviarme información, formas de pago y precio de envío? Gracias`;
  const whatsappUrl = `https://wa.me/5491165756608?text=${encodeURIComponent(whatsappMessage)}`;
  
  return `
    <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <div class="relative aspect-square overflow-hidden group">
        <img src="${product.imageSrc}" 
             alt="${product.productName}" 
             class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
        ${product.hasPromo ? `
          <div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
            ${product.promoText}
          </div>
        ` : ''}
      </div>
      
      <div class="p-4 flex flex-col">
        ${product.variants.length > 0 ? `
          <div class="flex gap-2 mb-3 flex-wrap justify-center">
            ${variantsHtml}
          </div>
        ` : ''}
        
        <div class="text-center mb-3">
          <span class="text-3xl font-bold text-gray-900">
            ${product.price}
          </span>
        </div>

        <!-- Botón Agregar al carrito -->
        <a href="javascript:void(0);" 
           onclick="addToCart('${product.productName}', '${product.price}')"
           class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-base font-semibold transition-colors duration-200 no-underline text-center w-full block mb-2">
          Agregar al carrito
        </a>

        <!-- Botón Comprar directo -->
        <a href="${whatsappUrl}" 
           target="_blank"
           class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-base font-semibold transition-colors duration-200 no-underline text-center w-full block mb-3">
          Comprar
        </a>
        
        <h3 class="text-base font-semibold text-gray-700 text-center line-clamp-2">
          ${product.productName}
        </h3>
      </div>
    </div>
  `;
}

app.get("/productos", async (req, res) => {
  let products = [];
  
  for (let i = 1; i <= 10; i++) {
    const url = `https://gmnimportados.mitiendanube.com/productos/page/${i}`;
    console.log(`🧩 Procesando página ${i}...`);
    
    try {
      const htmlArray = await getProductListHtml(url);
      
      for (const html of htmlArray) {
        const productData = extractProductData(html);
        if (productData.productName) {
          products.push(productData);
        }
      }
    } catch (err) {
      console.error(`❌ Error en página ${i}:`, err.message);
    }
  }
  
  const productsHtml = products.map(p => generateProductCard(p)).join('');
 
  app.use(express.static(__dirname));

  const fullHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GWN.SHOP</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  </style>
  <link rel="icon" type="image/png" href="/GWN.SHOP.png">

</head>
<body class="bg-white">

  <!-- Navbar con logo -->
<nav class="w-full bg-white shadow-md fixed top-0 left-0 z-50">
  <div class="container mx-auto px-4 py-3 flex justify-center">
    <h1 class="text-3xl font-normal font-poppins tracking-tight">
      <span class="text-[#353535]">GWN</span><span class="text-[#C23235]">.</span><span class="text-[#3235C2]">SHOP</span>
    </h1>
  </div>
</nav>

<!-- Importar Poppins -->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400&display=swap" rel="stylesheet">

<style>
  .font-poppins {
    font-family: 'Poppins', sans-serif;
  }
</style>


  <div class="container mx-auto px-4 py-24">
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-2">Catálogo de Productos</h1>
      <p class="text-gray-600">Encontramos ${products.length} productos</p>
    </div>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      ${productsHtml}
    </div>
  </div>

  <!-- Carrito -->
  <div id="cart-container" class="fixed bottom-5 right-5 bg-white shadow-lg rounded-lg p-4 w-80 max-w-xs hidden z-50">
  <div class="flex items-center gap-2 mb-2">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.2 6h12.4L17 13M7 13H5.4M17 13l1.2 6M6 19a1 1 0 100 2 1 1 0 000-2zm12 0a1 1 0 100 2 1 1 0 000-2z" />
    </svg>
    <h2 class="text-lg font-bold">Carrito de compras</h2>
  </div>
    <div id="cart-items" class="flex flex-col gap-2 mb-3"></div>
    <button id="checkout-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg w-full font-semibold">Comprar todo</button>
  </div>

  <script>
    const cart = [];

    function addToCart(name, price) {
      cart.push({ name, price });
      renderCart();
    }

    function removeFromCart(index) {
      cart.splice(index, 1);
      renderCart();
    }

    function renderCart() {
      const container = document.getElementById('cart-container');
      const itemsDiv = document.getElementById('cart-items');
      
      if (cart.length === 0) {
        container.classList.add('hidden');
        return;
      }
      
      container.classList.remove('hidden');
      itemsDiv.innerHTML = cart.map((item, i) => \`
        <div class="flex justify-between items-center">
          <span>\${item.name} - \${item.price}</span>
          <button onclick="removeFromCart(\${i})" class="text-red-500 font-bold px-2">X</button>
        </div>
      \`).join('');
    }

    document.getElementById('checkout-btn').addEventListener('click', () => {
      if (cart.length === 0) return;
      
      const message = \`Hola! Quisiera comprar los siguientes productos:\\n\\n\` +
        cart.map(item => \`\${item.name} - \${item.price}\`).join('\\n') +
        \`\\n\\nGracias!\`;
      
      const whatsappUrl = \`https://wa.me/5491165756608?text=\${encodeURIComponent(message)}\`;
      window.open(whatsappUrl, '_blank');
    });
  </script>
</body>
</html>
  `;
  
  res.send(fullHtml);
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Abrí http://localhost:${PORT}/productos para ver los productos con estilo`);
});
