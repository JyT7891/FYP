# Pydantic schemas for API request validation and data transfer
from pydantic import BaseModel, EmailStr

# Schema for URL phishing prediction request
class URLRequest(BaseModel):
    url: str

# Schema for user registration request
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"

# Schema for user login request
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Schema for reporting suspicious URLs
class ReportRequest(BaseModel):
    url: str
    note: str = ""

# Schema for updating user profile information
class ProfileUpdateRequest(BaseModel):
    name: str = ""
    email: str = ""

# Schema for updating user password
class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

# Schema for initiating password reset via email
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

# Schema for resetting password using token
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Schema for verifying registration email code
class VerifyRegistrationRequest(BaseModel):
    user_id: str
    code: str

# Duplicate schema definition (should be removed or consolidated)
class VerifyRegistrationRequest(BaseModel):
    user_id: str
    code: str