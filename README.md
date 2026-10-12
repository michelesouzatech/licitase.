# LicitaSE

Agente que analisa editais e termos de referência de licitação e emite um parecer sobre **entrar ou não na disputa**, com base nos produtos da SoftExpert.

> **Contexto:** um dos meus primeiros projetos com IA, criado no Lovable em fevereiro de 2026, quando eu estava começando na área técnica. O banco no Supabase está **pausado**, então o app hoje não tem dados ao vivo. Fica aqui como registro da minha evolução (compare com o [Meu Ritmo](https://github.com/michelesouzatech/meu-ritmo)).

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)

## Problema que resolve

Ler um edital de licitação inteiro, cruzar com o que a empresa vende e decidir se vale participar leva horas. O LicitaSE faz essa primeira leitura e entrega um parecer estruturado, pra equipe comercial decidir mais rápido.

## Como funciona

1. A pessoa envia o edital (PDF ou Word).
2. O texto é extraído no próprio navegador.
3. Uma função no Supabase manda o conteúdo pra um modelo de IA, junto com a base de conhecimento dos produtos.
4. O resultado volta em **12 seções**: objeto, resumo executivo, cronograma, habilitação, atestados, aderência à matriz de produtos, evidências, módulos, diferenciais, riscos, viabilidade e a conclusão **Go / No-Go**.
5. As análises ficam salvas no histórico e podem ser exportadas em PDF.

## Estrutura do projeto

Estrutura, estilo e lógica ficam em arquivos separados, cada um com uma função:

```
licitase./
├── index.html              # Ponto de entrada: só carrega o app
├── src/
│   ├── main.tsx            # Liga o React ao index.html
│   ├── App.tsx             # Rotas do app
│   ├── index.css           # Estilos globais e tema (Tailwind)
│   ├── pages/              # Telas: análise, histórico, base de conhecimento
│   ├── components/         # Peças reaproveitadas (resultado da análise, componentes de interface)
│   ├── hooks/              # Lógica reaproveitável com estado
│   ├── lib/                # Leitura de documentos e utilitários
│   ├── utils/              # Exportação em PDF, validações, funções auxiliares
│   ├── types/              # Formato dos dados (as 12 seções da análise)
│   └── integrations/       # Conexão com o Supabase
└── supabase/
    ├── functions/          # Funções do servidor (analisar edital, listar, atualizar, processar documentos)
    └── migrations/         # Histórico de criação das tabelas do banco
```

## Tecnologias

- **Front-end:** React, TypeScript, Vite, Tailwind CSS e componentes shadcn/ui
- **Back-end:** Supabase (Postgres e funções de servidor)
- **IA:** modelo de linguagem acessado pela função `analisar-edital`
- **Exportação:** PDF gerado no navegador

## Rodar no computador

```bash
npm install
npm run dev
```

O app precisa de um arquivo `.env` (não versionado) com a URL e a chave pública do seu projeto Supabase:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## Autoria

Michele Souza, Sales Ops na SoftExpert, em transição para AI/ML Engineering.
