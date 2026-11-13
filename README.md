# Regional São Paulo — CCIB

Dashboard de gestão da Regional São Paulo da Câmara de Comércio Índia-Brasil (CCIB): associados, empresas, contatos, reuniões, pipeline, follow-ups, eventos e conexões empresariais.

Este é um site estático simples (HTML + CSS + JavaScript puro, sem necessidade de build) — pronto para publicar no Vercel a partir de um repositório no GitHub.

---

## 1. Colocar o código no GitHub

1. Acesse [github.com](https://github.com) e crie uma conta, se ainda não tiver.
2. Clique em **New repository** (botão verde, ou o "+" no canto superior direito → *New repository*).
3. Dê um nome, por exemplo `regional-sp-ccib`. Pode deixar como **Private** (só a equipe vê o código) ou **Public**, como preferir.
4. **Não** marque "Add a README" (já temos um).
5. Clique em **Create repository**.
6. Na página do repositório vazio, clique no link **"uploading an existing file"** (ou vá em **Add file → Upload files**).
7. Arraste **todos os arquivos e pastas** deste projeto (`index.html`, as pastas `css/`, `js/`, `data/`, `assets/`, e este `README.md`) para dentro da janela do navegador.
8. Role para baixo e clique em **Commit changes**.

Pronto — o código está no GitHub.

## 2. Publicar no Vercel

1. Acesse [vercel.com](https://vercel.com) e clique em **Sign Up** (o mais fácil é entrar com **"Continue with GitHub"**, usando a mesma conta do passo anterior).
2. No painel do Vercel, clique em **Add New → Project**.
3. Selecione o repositório `regional-sp-ccib` que você acabou de criar e clique em **Import**.
4. Não precisa mudar nada nas configurações — é um site estático, o Vercel detecta isso sozinho. Clique em **Deploy**.
5. Em menos de um minuto, o Vercel mostra o link do site publicado (algo como `regional-sp-ccib.vercel.app`). É esse link que Pedro e Rafaela vão usar no dia a dia.

A partir de agora, **todo `commit` que vocês fizerem no GitHub publica uma nova versão automaticamente** no mesmo link — não precisa repetir o passo 2 em diante.

## 3. Como atualizar os dados do HubSpot

Os números de empresas e negócios ficam no arquivo `data/snapshot.json`, separado do resto do código.

1. Abra uma conversa com o Claude e peça: *"Atualize os dados do HubSpot no dashboard da Regional São Paulo"*.
2. O Claude vai gerar um novo arquivo `snapshot.json` com os dados mais recentes.
3. No GitHub, abra a pasta `data/`, clique no arquivo `snapshot.json` → ícone de lápis (**Edit**) → apague o conteúdo antigo → cole o novo → **Commit changes**.
4. O Vercel republica sozinho em segundos.

## Como o painel define o status de cada empresa

O status mostrado no painel segue a situação do **negócio** no HubSpot (e não só o status da empresa):

- **Associado:** empresa marcada como "Customer" no HubSpot ou com negócio **ganho**.
- **Em negociação:** negócio **aberto** (ou empresa em "Oportunidade" sem negócio vinculado).
- **Negócio perdido:** negócio **perdido** — mesmo que a empresa ainda conste como "Oportunidade" no HubSpot.
- **Prospecção:** empresa em "Lead" sem negócio.

O vínculo entre empresa e negócio é feito pelo nome (e pelo domínio, quando o nome não bate). Se um nome for diferente nos dois cadastros, o painel não consegue ligar os dois — nesse caso vale padronizar o nome no HubSpot.

## 4. Eventos da Regional (visíveis para toda a equipe)

Os eventos realizados e os próximos ficam no arquivo `data/eventos.json`. Tudo que está nele aparece para **todo mundo** que abrir o site — a aba "Eventos" separa automaticamente em *Próximos* e *Realizados* pela data (um evento passa para "Realizados" no dia seguinte à sua data).

Para incluir ou editar um evento, abra `data/eventos.json` no GitHub (ícone de lápis), copie um bloco existente, ajuste os campos e faça o **Commit** — o Vercel republica sozinho. Campos disponíveis: `nome`, `data` (AAAA-MM-DD), `horario`, `local`, `formato`, `parceiros`, `temas`, `painel`, `empresasParticipantes`, `numParticipantes`, `resultado`, `observacoes` e `tag` (ex.: "Sem custo para a Câmara"). Cada evento precisa de um `id` único.

O botão "+ Novo evento" dentro do site também funciona, mas esses eventos ficam só no navegador de quem cadastrou (veja a seção seguinte).

## 5. Importante: sobre reuniões, follow-ups, conexões, pipeline e eventos cadastrados pelo botão

Essas informações (tudo que a equipe cadastra manualmente dentro do painel) ficam salvas no **navegador de cada pessoa** (`localStorage`), não em um servidor compartilhado.

Isso quer dizer que, **hoje**, o que o Pedro registra no computador dele não aparece automaticamente no computador da Rafaela, e vice-versa. Cada um vê só o que cadastrou no próprio navegador/dispositivo.

### Próximo passo (opcional): dados realmente compartilhados

Para que reuniões, follow-ups, eventos e conexões fiquem visíveis para toda a equipe, independente de quem cadastrou e em qual dispositivo, o painel precisa de um banco de dados real por trás. A forma mais simples de resolver isso é conectar um banco gratuito como o **Supabase** — é rápido de configurar e eu posso te ajudar a integrar isso ao código sempre que quiserem seguir com essa etapa. Basta pedir.

---

**Estrutura do projeto:**
```
index.html          → página principal do painel
css/style.css        → estilos visuais
js/app.js            → toda a lógica do painel
data/snapshot.json   → dados do HubSpot (empresas, negócios, KPIs)
data/eventos.json    → eventos realizados e próximos (visíveis para toda a equipe)
assets/logo.png       → logo da Regional São Paulo
vercel.json          → configuração explícita de deploy (evita cache antigo do snapshot.json)
```

## Reuniões e calendário

A aba **Reuniões** mostra um calendário mensal (alternável para lista). As reuniões vêm de `data/reunioes.json`,
gerado a partir da agenda do Outlook/Teams da Rafaela (somente reuniões com empresas/parceiros; sem links do Teams).

Para atualizar: peça ao Claude "atualize as reuniões pela minha agenda", e substitua `data/reunioes.json` no GitHub.
Reuniões registradas pelo botão "+ Registrar reunião" ficam salvas apenas no navegador de quem registrou.

## Pipeline — "Apenas contato"

A primeira coluna do Pipeline reúne empresas com quem só há contato (sem oportunidade comercial). Para incluir uma empresa
por padrão para todos, adicione o id do HubSpot em `data/apenas-contato.json`. Também dá para mover qualquer card para essa
coluna pelo seletor de etapa (fica salvo só no navegador).
