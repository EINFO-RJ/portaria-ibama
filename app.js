// Detecta dinamicamente a origem
const API_URL = window.location.origin.includes(':3000') 
  ? window.location.origin 
  : `${window.location.protocol}//${window.location.hostname}:3000`;

let chartSetoresInst = null;
let chartFluxoInst = null;

function esconderSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('oculto');
    setTimeout(() => { splash.style.display = 'none'; }, 600);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginScreen = document.getElementById('tela-login');
  const mainApp = document.getElementById('painel-principal');

  // Garante estado inicial (Apenas Login Visível)
  if (sessionStorage.getItem('usuario_logado')) {
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    await Promise.all([carregarVisitantes(), carregarPrestadores()]);
  } else {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
  }

  // Login
  document.getElementById('form-login')?.addEventListener('submit', realizarLogin);
  document.getElementById('btn-login-submit')?.addEventListener('click', realizarLogin);

  // Visitantes (Submit do Form ou Clique no Botão)
  document.getElementById('form-visitante')?.addEventListener('submit', registrarVisitante);
  document.getElementById('btn-submit-visitante')?.addEventListener('click', registrarVisitante);
  
  // Manutenção Predial
  document.getElementById('form-manutencao')?.addEventListener('submit', registrarPrestador);
  document.getElementById('btn-submit-manutencao')?.addEventListener('click', registrarPrestador);
  
  // Relatórios
  document.getElementById('filtro-tipo')?.addEventListener('change', carregarRelatorios);
  document.getElementById('filtro-mes')?.addEventListener('change', carregarRelatorios);
  document.getElementById('filtro-ano')?.addEventListener('change', carregarRelatorios);
  document.getElementById('filtro-setor')?.addEventListener('change', carregarRelatorios);

  setTimeout(esconderSplashScreen, 800);
});

function mudarAba(abaId, elemento, cor) {
  document.querySelectorAll('.painel-secao').forEach(el => el.classList.remove('ativo'));
  document.querySelectorAll('.btn-nav').forEach(el => el.classList.remove('ativo-verde', 'ativo-laranja'));

  const secao = document.getElementById(`aba-${abaId}`);
  if (secao) secao.classList.add('ativo');
  if (elemento) elemento.classList.add(`ativo-${cor}`);

  if (abaId === 'dashboard') atualizarDashboard();
  if (abaId === 'relatorios') carregarRelatorios();
}

function getAgoraFormatado() {
  const agora = new Date();
  return agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function extrairMesEAno(strData) {
  if (!strData) return { mes: null, ano: null };

  if (strData.includes('-')) {
    const partes = strData.split('T')[0].split('-');
    if (partes.length >= 3) {
      return { mes: partes[1], ano: partes[0] };
    }
  }

  if (strData.includes('/')) {
    const dataPart = strData.split(' ')[0];
    const partes = dataPart.split('/');
    if (partes.length === 3) {
      return { mes: partes[1].padStart(2, '0'), ano: partes[2] };
    }
  }

  return { mes: null, ano: null };
}

// ---------------- AUTENTICAÇÃO ----------------
async function realizarLogin(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  const senha = document.getElementById('senha')?.value.trim();

  if (!email || !senha) return;

  try {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    
    const data = await res.json();

    if (res.ok && (data.success || data.user)) {
      sessionStorage.setItem('usuario_logado', JSON.stringify(data.user || { email }));
      
      // Oculta tela de login e exibe o sistema principal
      const loginScreen = document.getElementById('tela-login');
      const mainApp = document.getElementById('painel-principal');
      if (loginScreen) loginScreen.style.display = 'none';
      if (mainApp) mainApp.style.display = 'block';

      await Promise.all([carregarVisitantes(), carregarPrestadores()]);
    } else {
      alert(data.message || 'Credenciais inválidas!');
    }
  } catch (err) {
    console.error('Erro no login:', err);
    alert('Erro ao conectar com o servidor. Verifique a conexão.');
  }
}

function fazerLogout() {
  sessionStorage.removeItem('usuario_logado');
  const loginScreen = document.getElementById('tela-login');
  const mainApp = document.getElementById('painel-principal');

  if (mainApp) mainApp.style.display = 'none';
  if (loginScreen) loginScreen.style.display = 'flex';
  
  document.getElementById('form-login')?.reset();
}

// ---------------- VISITANTES ----------------
async function carregarVisitantes() {
  let dados = [];
  try {
    const res = await fetch(`${API_URL}/api/visitantes`);
    if (res.ok) dados = await res.json();
  } catch (err) {
    console.error('Erro ao carregar visitantes:', err);
  }

  dados = Array.isArray(dados) ? dados : [];

  const dadosUnicos = [];
  const idsVistos = new Set();

  for (const item of dados) {
    const chave = item.id ? `id_${item.id}` : `${item.nome}_${item.data_entrada}`;
    if (!idsVistos.has(chave)) {
      idsVistos.add(chave);
      dadosUnicos.push(item);
    }
  }

  const tbodyAtivos = document.getElementById('tabela-visitantes-ativos');
  const tbodyHistorico = document.getElementById('tabela-visitantes-historico');

  if (tbodyAtivos) tbodyAtivos.innerHTML = '';
  if (tbodyHistorico) tbodyHistorico.innerHTML = '';

  const hoje = new Date().toLocaleDateString('pt-BR');

  const ativos = dadosUnicos.filter(v => !v.data_saida);

  if (tbodyAtivos) {
    if (ativos.length === 0) {
      tbodyAtivos.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #64748b;">Nenhum visitante ativo no momento.</td></tr>';
    } else {
      ativos.forEach(v => {
        const setorExibicao = v.setor_destino || v.setor || '-';
        tbodyAtivos.innerHTML += `
          <tr>
            <td>${v.nome}</td>
            <td>${setorExibicao}</td>
            <td>${v.atividade || '-'}</td>
            <td>${v.data_entrada}</td>
            <td style="text-align: center;">
              <div class="acoes-container">
                <button class="btn-etiqueta" onclick="imprimirEtiqueta('${v.nome}', '${setorExibicao}', 'VISITANTE')">🖨️ Etiqueta</button>
                <button class="btn-saida" onclick="darSaidaVisitante(${v.id})">Dar Saída</button>
              </div>
            </td>
          </tr>`;
      });
    }
  }

  const movimentacoesHoje = dadosUnicos.filter(v => {
    const dataEntradaApenas = v.data_entrada ? v.data_entrada.split(' ')[0] : '';
    const dataSaidaApenas = v.data_saida ? v.data_saida.split(' ')[0] : '';
    return dataEntradaApenas === hoje || dataSaidaApenas === hoje;
  });

  if (tbodyHistorico) {
    if (movimentacoesHoje.length === 0) {
      tbodyHistorico.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #64748b;">Nenhuma movimentação registrada hoje.</td></tr>';
    } else {
      movimentacoesHoje.forEach(v => {
        const setorExibicao = v.setor_destino || v.setor || '-';
        tbodyHistorico.innerHTML += `
          <tr>
            <td>${v.nome}</td>
            <td>${setorExibicao}</td>
            <td>${v.atividade || '-'}</td>
            <td>${v.data_entrada}</td>
            <td>${v.data_saida ? v.data_saida : '<span style="color:#065f46; font-weight:bold;">No prédio</span>'}</td>
          </tr>`;
      });
    }
  }
}

async function registrarVisitante(e) {
  if (e) e.preventDefault();

  const form = document.getElementById('form-visitante');
  const btnSubmit = document.getElementById('btn-submit-visitante') || form?.querySelector('button');

  if (btnSubmit && btnSubmit.disabled) return;

  const nome = document.getElementById('v-nome')?.value.trim();
  const documento = document.getElementById('v-documento')?.value.trim();
  const setor = document.getElementById('v-setor')?.value;
  const atividade = document.getElementById('v-atividade')?.value.trim();

  if (!nome || !documento || !setor) {
    alert('Preencha os campos obrigatórios!');
    return;
  }

  if (btnSubmit) btnSubmit.disabled = true;

  const novoVisitante = {
    nome,
    documento,
    setor,
    setor_destino: setor,
    atividade,
    data_entrada: getAgoraFormatado(),
    data_saida: null
  };

  try {
    const res = await fetch(`${API_URL}/api/visitantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoVisitante)
    });

    if (res.ok) {
      if (form) form.reset();
      await carregarVisitantes();
    } else {
      const errData = await res.json();
      alert(`Erro: ${errData.error || 'Erro ao cadastrar'}`);
    }
  } catch (err) {
    console.error('Erro ao registrar visitante:', err);
    alert('Erro de conexão ao registrar visitante.');
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

async function darSaidaVisitante(id) {
  const horaSaida = getAgoraFormatado();
  try {
    const res = await fetch(`${API_URL}/api/visitantes/${id}/saida`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_saida: horaSaida })
    });

    if (res.ok) {
      await carregarVisitantes();
    } else {
      alert('Erro ao registrar saída do visitante.');
    }
  } catch (err) {
    console.error('Erro ao dar saída no visitante:', err);
    alert('Erro de conexão ao dar saída.');
  }
}

// ---------------- MANUTENÇÃO PREDIAL ----------------
async function carregarPrestadores() {
  let dados = [];
  try {
    const res = await fetch(`${API_URL}/api/manutencao`);
    if (res.ok) dados = await res.json();
  } catch (err) {
    console.error('Erro ao carregar prestadores:', err);
  }

  dados = Array.isArray(dados) ? dados : [];

  const tbodyAtivos = document.getElementById('tabela-prestadores-ativos');
  const tbodyHistorico = document.getElementById('tabela-prestadores-historico');

  if (tbodyAtivos) tbodyAtivos.innerHTML = '';
  if (tbodyHistorico) tbodyHistorico.innerHTML = '';

  const hoje = new Date().toLocaleDateString('pt-BR');

  const ativos = dados.filter(p => !p.data_saida);

  if (tbodyAtivos) {
    if (ativos.length === 0) {
      tbodyAtivos.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #64748b;">Nenhum prestador ativo no momento.</td></tr>';
    } else {
      ativos.forEach(p => {
        tbodyAtivos.innerHTML += `
          <tr>
            <td>${p.nome}</td>
            <td>${p.empresa}</td>
            <td>${p.atividade || '-'}</td>
            <td>${p.data_entrada}</td>
            <td style="text-align: center;">
              <div class="acoes-container">
                <button class="btn-etiqueta" onclick="imprimirEtiqueta('${p.nome}', '${p.empresa}', 'PRESTADOR DE SERVIÇO')">🖨️ Etiqueta</button>
                <button class="btn-saida" onclick="darSaidaPrestador(${p.id})">Dar Saída</button>
              </div>
            </td>
          </tr>`;
      });
    }
  }

  const movimentacoesHoje = dados.filter(p => {
    const dataEntradaApenas = p.data_entrada ? p.data_entrada.split(' ')[0] : '';
    const dataSaidaApenas = p.data_saida ? p.data_saida.split(' ')[0] : '';
    return dataEntradaApenas === hoje || dataSaidaApenas === hoje;
  });

  if (tbodyHistorico) {
    if (movimentacoesHoje.length === 0) {
      tbodyHistorico.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #64748b;">Nenhuma movimentação registrada hoje.</td></tr>';
    } else {
      movimentacoesHoje.forEach(p => {
        tbodyHistorico.innerHTML += `
          <tr>
            <td>${p.nome}</td>
            <td>${p.empresa}</td>
            <td>${p.atividade || '-'}</td>
            <td>${p.data_entrada}</td>
            <td>${p.data_saida ? p.data_saida : '<span style="color:#c2410c; font-weight:bold;">No prédio</span>'}</td>
          </tr>`;
      });
    }
  }
}

async function registrarPrestador(e) {
  if (e) e.preventDefault();

  const form = document.getElementById('form-manutencao');
  const btnSubmit = document.getElementById('btn-submit-manutencao') || form?.querySelector('button');

  if (btnSubmit && btnSubmit.disabled) return;

  const nome = document.getElementById('m-nome')?.value.trim();
  const documento = document.getElementById('m-documento')?.value.trim();
  const empresa = document.getElementById('m-empresa')?.value.trim();
  const atividade = document.getElementById('m-atividade')?.value.trim();

  if (!nome || !documento || !empresa) {
    alert('Preencha os campos obrigatórios!');
    return;
  }

  if (btnSubmit) btnSubmit.disabled = true;

  const novoPrestador = {
    nome,
    documento,
    empresa,
    atividade,
    data_entrada: getAgoraFormatado(),
    data_saida: null
  };

  try {
    const res = await fetch(`${API_URL}/api/manutencao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoPrestador)
    });

    if (res.ok) {
      if (form) form.reset();
      await carregarPrestadores();
    } else {
      const errData = await res.json();
      alert(`Erro: ${errData.error || 'Erro ao registrar'}`);
    }
  } catch (err) {
    console.error('Erro ao registrar prestador:', err);
    alert('Erro de conexão ao registrar prestador.');
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

async function darSaidaPrestador(id) {
  const horaSaida = getAgoraFormatado();
  try {
    const res = await fetch(`${API_URL}/api/manutencao/${id}/saida`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_saida: horaSaida })
    });

    if (res.ok) {
      await carregarPrestadores();
    } else {
      alert('Erro ao registrar saída do prestador.');
    }
  } catch (err) {
    console.error('Erro ao dar saída no prestador:', err);
    alert('Erro de conexão ao dar saída.');
  }
}

// ---------------- DASHBOARD ----------------
async function atualizarDashboard() {
  let visitantes = [], prestadores = [];
  try {
    const resV = await fetch(`${API_URL}/api/visitantes`);
    visitantes = resV.ok ? await resV.json() : [];
    
    const resP = await fetch(`${API_URL}/api/manutencao`);
    prestadores = resP.ok ? await resP.json() : [];
  } catch (err) {
    console.error('Erro ao atualizar dashboard:', err);
  }

  visitantes = Array.isArray(visitantes) ? visitantes : [];
  prestadores = Array.isArray(prestadores) ? prestadores : [];

  const vAtivos = visitantes.filter(v => !v.data_saida).length;
  const pAtivos = prestadores.filter(p => !p.data_saida).length;

  if (document.getElementById('dash-v-ativos')) document.getElementById('dash-v-ativos').innerText = vAtivos;
  if (document.getElementById('dash-p-ativos')) document.getElementById('dash-p-ativos').innerText = pAtivos;
  if (document.getElementById('dash-total-hoje')) document.getElementById('dash-total-hoje').innerText = visitantes.length + prestadores.length;

  renderizarGraficos(visitantes, prestadores, vAtivos, pAtivos);
}

function renderizarGraficos(visitantes, prestadores, vAtivos, pAtivos) {
  const ctxSetores = document.getElementById('chartSetores')?.getContext('2d');
  const ctxFluxo = document.getElementById('chartFluxo')?.getContext('2d');

  if (!ctxSetores || !ctxFluxo) return;

  const setoresContagem = {};
  visitantes.forEach(v => {
    const setor = v.setor_destino || v.setor;
    if (setor) {
      setoresContagem[setor] = (setoresContagem[setor] || 0) + 1;
    }
  });

  const labelsSetores = Object.keys(setoresContagem);
  const dataSetores = Object.values(setoresContagem);
  const paletaCores = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#4b5563', '#e11d48', '#059669'];

  if (chartSetoresInst) chartSetoresInst.destroy();
  chartSetoresInst = new Chart(ctxSetores, {
    type: 'doughnut',
    data: {
      labels: labelsSetores.length ? labelsSetores : ['Sem dados'],
      datasets: [{
        data: dataSetores.length ? dataSetores : [1],
        backgroundColor: labelsSetores.length ? paletaCores.slice(0, labelsSetores.length) : ['#cbd5e1'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });

  if (chartFluxoInst) chartFluxoInst.destroy();
  chartFluxoInst = new Chart(ctxFluxo, {
    type: 'bar',
    data: {
      labels: ['Visitantes', 'Manutenção', 'Ativos no Prédio'],
      datasets: [{
        label: 'Quantidade',
        data: [visitantes.length, prestadores.length, (vAtivos + pAtivos)],
        backgroundColor: ['#059669', '#d97706', '#2563eb'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ---------------- RELATÓRIOS E EXPORTAÇÃO PDF ----------------
async function carregarRelatorios() {
  const tipo = document.getElementById('filtro-tipo')?.value;
  const mes = document.getElementById('filtro-mes')?.value;
  const ano = document.getElementById('filtro-ano')?.value;
  const setor = document.getElementById('filtro-setor')?.value;

  const containerSetor = document.getElementById('container-filtro-setor');
  if (containerSetor) containerSetor.style.display = (tipo === 'manutencao') ? 'none' : 'block';

  const endpoint = tipo === 'visitantes' ? `${API_URL}/api/visitantes` : `${API_URL}/api/manutencao`;
  let dados = [];

  try {
    const res = await fetch(endpoint);
    if (res.ok) dados = await res.json();
  } catch (err) {
    console.error('Erro ao buscar dados do relatório:', err);
  }

  dados = Array.isArray(dados) ? dados : [];

  dados = dados.filter(item => {
    const itemSetor = item.setor_destino || item.setor || '';

    if (tipo === 'visitantes' && setor !== 'todos' && itemSetor !== setor) {
      return false;
    }

    if (item.data_entrada) {
      const { mes: itemMes, ano: itemAno } = extrairMesEAno(item.data_entrada);

      if (mes !== 'todos' && itemMes) {
        const mesFiltro = mes.padStart(2, '0');
        if (itemMes !== mesFiltro) return false;
      }

      if (ano !== 'todos' && itemAno) {
        if (itemAno !== ano) return false;
      }
    }

    return true;
  });

  const cabecalho = document.getElementById('cabecalho-tabela-relatorio');
  const tbody = document.getElementById('tabela-historico-filtrado');

  if (cabecalho) {
    cabecalho.innerHTML = tipo === 'visitantes' 
      ? `<th>Nome</th><th>Documento</th><th>Setor</th><th>Atividade</th><th>Entrada</th><th>Saída</th>`
      : `<th>Nome</th><th>Documento</th><th>Empresa</th><th>Atividade</th><th>Entrada</th><th>Saída</th>`;
  }

  if (tbody) {
    tbody.innerHTML = '';
    if (dados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #64748b;">Nenhum registro encontrado.</td></tr>';
      return;
    }

    dados.forEach(i => {
      const setorExibicao = i.setor_destino || i.setor || '-';
      tbody.innerHTML += `
        <tr>
          <td>${i.nome}</td>
          <td>${i.documento || '-'}</td>
          <td>${tipo === 'visitantes' ? setorExibicao : (i.empresa || '-')}</td>
          <td>${i.atividade || '-'}</td>
          <td>${i.data_entrada}</td>
          <td>${i.data_saida || 'Ainda presente'}</td>
        </tr>`;
    });
  }
}

function exportarRelatorioPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('Biblioteca jsPDF não foi carregada corretamente.');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const tipo = document.getElementById('filtro-tipo')?.value;
    const titulo = tipo === 'visitantes' ? 'Relatório de Visitas - IBAMA RJ' : 'Relatório de Manutenção - IBAMA RJ';

    doc.setFontSize(16);
    doc.text(titulo, 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${getAgoraFormatado()}`, 14, 25);

    const headers = tipo === 'visitantes' 
      ? [['Nome', 'Setor', 'Atividade', 'Entrada', 'Saída']]
      : [['Nome', 'Empresa', 'Atividade', 'Entrada', 'Saída']];

    const rows = [];
    document.querySelectorAll('#tabela-historico-filtrado tr').forEach(tr => {
      const row = [];
      const tds = tr.querySelectorAll('td');
      if (tds.length > 1) {
        tds.forEach((td, index) => {
          if (index !== 1) row.push(td.innerText);
        });
        rows.push(row);
      }
    });

    doc.autoTable({
      startY: 30,
      head: headers,
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [6, 95, 70] }
    });

    doc.save(`${tipo}_ibama_${Date.now()}.pdf`);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    alert('Erro ao gerar o arquivo PDF.');
  }
}

// ---------------- IMPRESSÃO DE ETIQUETA ----------------
function imprimirEtiqueta(nome, setor, tipo = 'VISITANTE') {
  const janelaImpressao = window.open('', '', 'width=400,height=500');
  janelaImpressao.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Etiqueta de Acesso - IBAMA RJ</title>
      <style>
        @page { size: 80mm 60mm; margin: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 8px; width: 80mm; box-sizing: border-box; background: #fff; color: #000; }
        .etiqueta-card { border: 2px solid #005a36; border-radius: 6px; padding: 8px; text-align: center; }
        .header { display: flex; align-items: center; justify-content: center; gap: 8px; border-bottom: 2px solid #005a36; padding-bottom: 6px; margin-bottom: 8px; }
        .header img { max-height: 35px; }
        .header-title { font-size: 11px; font-weight: bold; color: #005a36; text-transform: uppercase; line-height: 1.1; }
        .badge-tipo { background-color: #005a36; color: #ffffff; font-size: 14px; font-weight: bold; letter-spacing: 1px; padding: 3px 0; margin: 4px 0; border-radius: 3px; text-transform: uppercase; }
        .info-group { margin: 6px 0; text-align: left; }
        .label { font-size: 8px; text-transform: uppercase; color: #555; font-weight: bold; }
        .valor-nome { font-size: 15px; font-weight: bold; color: #000; word-wrap: break-word; }
        .valor-setor { font-size: 12px; font-weight: bold; color: #333; }
        .footer-data { margin-top: 8px; border-top: 1px dashed #ccc; padding-top: 4px; font-size: 9px; color: #666; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="etiqueta-card">
        <div class="header">
          <img src="logo-ibama.png" alt="Logo IBAMA" />
          <div class="header-title">IBAMA - RJ<br><span style="font-size: 8px; font-weight: normal;">Superintendência do RJ</span></div>
        </div>
        <div class="badge-tipo">${tipo}</div>
        <div class="info-group">
          <div class="label">NOME:</div>
          <div class="valor-nome">${nome}</div>
        </div>
        <div class="info-group">
          <div class="label">SETOR / EMPRESA:</div>
          <div class="valor-setor">${setor}</div>
        </div>
        <div class="footer-data">
          <span>EMISSÃO: ${getAgoraFormatado()}</span>
          <span>SISTEMA PORTARIA</span>
        </div>
      </div>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      <\/script>
    </body>
    </html>
  `);
  janelaImpressao.document.close();
}
