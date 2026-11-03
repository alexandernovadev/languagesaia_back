#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
LOGIN_USERNAME="novask88"
LOGIN_PASSWORD="sashateamomucho"

echo -e "${BLUE}🚀 LanguageAI Backup Service Testing${NC}"
echo "=================================="

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s "$BASE_URL" > /dev/null; then
    print_error "Server is not running at $BASE_URL"
    print_info "Please start the server first with: npm run dev"
    exit 1
fi
print_status "Server is running at $BASE_URL"

# Step 1: Login and get JWT token
echo ""
echo "🔐 Step 1: Login and get JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"username\": \"$LOGIN_USERNAME\",
        \"password\": \"$LOGIN_PASSWORD\"
    }")

# Extract token from response
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    print_error "Failed to get JWT token"
    print_info "Login response: $LOGIN_RESPONSE"
    exit 1
fi

print_status "JWT token obtained successfully"
print_info "Token: ${TOKEN:0:20}..."

# Step 2: Test backup service status
echo ""
echo "📊 Step 2: Testing backup service status..."
STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/backup/status" \
    -H "Authorization: Bearer $TOKEN")

echo "Status Response: $STATUS_RESPONSE"

# Step 3: Test email connection only
echo ""
echo "📧 Step 3: Testing email connection..."
EMAIL_TEST_RESPONSE=$(curl -s -X GET "$BASE_URL/api/backup/test-email" \
    -H "Authorization: Bearer $TOKEN")

echo "Email Test Response: $EMAIL_TEST_RESPONSE"

# Step 4: Test backup service (without sending email)
echo ""
echo "🧪 Step 4: Testing backup service..."
BACKUP_TEST_RESPONSE=$(curl -s -X GET "$BASE_URL/api/backup/test" \
    -H "Authorization: Bearer $TOKEN")

echo "Backup Test Response: $BACKUP_TEST_RESPONSE"


echo ""
# Step 5: Send real backup (if all tests passed)
echo ""
echo "📧 Step 5: Sending real backup..."
print_info "This will send actual JSON files to titoantifa69@gmail.com"

BACKUP_SEND_RESPONSE=$(curl -s -X POST "$BASE_URL/api/backup/send-now" \
    -H "Authorization: Bearer $TOKEN")

echo "Backup Send Response: $BACKUP_SEND_RESPONSE"

# Check if backup was sent successfully
if echo "$BACKUP_SEND_RESPONSE" | grep -q '"success":true'; then
    print_status "Backup sent successfully!"
    print_info "Check your email at titoantifa69@gmail.com"
    print_info "You should receive:"
    print_info "- Subject: 🔒 Backup Diario - LanguageAI [Date]"
    print_info "- 3 JSON files attached (words, expressions and exams)"
else
    print_error "Backup failed to send"
    print_info "Check the response above for errors"
fi

echo ""
echo "🎯 ALL TESTS COMPLETED!"
echo "=================================="
print_status "Script finished - check your email!"
