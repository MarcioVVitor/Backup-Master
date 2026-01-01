#!/bin/bash

# ============================================================================
# NBM - Network Backup Manager
# Script de Build para Release
# ============================================================================

set -e

VERSION="${1:-1.0.0}"
OUTPUT_DIR="release"
PACKAGE_NAME="nbm-v${VERSION}"

echo "============================================================"
echo "  NBM - Build Release v${VERSION}"
echo "============================================================"
echo ""

# Limpar diretorio de release anterior
rm -rf ${OUTPUT_DIR}
mkdir -p ${OUTPUT_DIR}

echo "[1/6] Copiando arquivos do projeto..."

# Copiar arquivos principais
cp -r client ${OUTPUT_DIR}/
cp -r server ${OUTPUT_DIR}/
cp -r shared ${OUTPUT_DIR}/
cp package.json ${OUTPUT_DIR}/
cp package-lock.json ${OUTPUT_DIR}/
cp drizzle.config.ts ${OUTPUT_DIR}/
cp tsconfig.json ${OUTPUT_DIR}/
cp vite.config.ts ${OUTPUT_DIR}/
cp tailwind.config.ts ${OUTPUT_DIR}/
cp postcss.config.cjs ${OUTPUT_DIR}/

echo "[2/6] Copiando arquivos de instalacao..."

# Copiar arquivos de instalacao
cp install/install.sh ${OUTPUT_DIR}/
cp install/README.md ${OUTPUT_DIR}/
cp install/LICENSE ${OUTPUT_DIR}/
cp install/CHANGELOG.md ${OUTPUT_DIR}/
cp install/.env.example ${OUTPUT_DIR}/
cp install/.gitignore ${OUTPUT_DIR}/

# Copiar documentacao
mkdir -p ${OUTPUT_DIR}/docs
cp -r install/docs/* ${OUTPUT_DIR}/docs/

# Copiar GitHub Actions
mkdir -p ${OUTPUT_DIR}/.github/workflows
cp -r install/.github/workflows/* ${OUTPUT_DIR}/.github/workflows/

echo "[3/6] Removendo arquivos desnecessarios..."

# Remover arquivos especificos do Replit
rm -f ${OUTPUT_DIR}/.replit
rm -f ${OUTPUT_DIR}/replit.nix
rm -rf ${OUTPUT_DIR}/.cache
rm -rf ${OUTPUT_DIR}/node_modules
rm -rf ${OUTPUT_DIR}/dist

echo "[4/6] Criando pacote tar.gz..."

# Criar tarball
cd ${OUTPUT_DIR}
tar -czf ../${PACKAGE_NAME}.tar.gz .
cd ..

echo "[5/6] Criando pacote zip..."

# Criar zip
cd ${OUTPUT_DIR}
zip -rq ../${PACKAGE_NAME}.zip .
cd ..

echo "[6/6] Limpando..."

# Calcular tamanhos
TAR_SIZE=$(du -h ${PACKAGE_NAME}.tar.gz | cut -f1)
ZIP_SIZE=$(du -h ${PACKAGE_NAME}.zip | cut -f1)

echo ""
echo "============================================================"
echo "  Build Concluido!"
echo "============================================================"
echo ""
echo "Pacotes criados:"
echo "  - ${PACKAGE_NAME}.tar.gz (${TAR_SIZE})"
echo "  - ${PACKAGE_NAME}.zip (${ZIP_SIZE})"
echo ""
echo "Diretorio de release: ${OUTPUT_DIR}/"
echo ""
echo "Para publicar no GitHub:"
echo "  1. Crie um repositorio no GitHub"
echo "  2. Execute: cd ${OUTPUT_DIR}"
echo "  3. Execute: git init"
echo "  4. Execute: git add ."
echo "  5. Execute: git commit -m 'Initial commit v${VERSION}'"
echo "  6. Execute: git remote add origin https://github.com/seu-usuario/nbm.git"
echo "  7. Execute: git push -u origin main"
echo "  8. Execute: git tag v${VERSION}"
echo "  9. Execute: git push origin v${VERSION}"
echo ""
echo "Ou use o GitHub CLI:"
echo "  gh repo create nbm --public --source=${OUTPUT_DIR}"
echo "  cd ${OUTPUT_DIR} && gh release create v${VERSION} ../${PACKAGE_NAME}.tar.gz ../${PACKAGE_NAME}.zip"
echo ""
