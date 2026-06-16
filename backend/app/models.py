from pydantic import BaseModel, EmailStr

class URLRequest(BaseModel):
    url: str

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ReportRequest(BaseModel):
    url: str
    note: str = ""

class ProfileUpdateRequest(BaseModel):
    name: str = ""
    email: str = ""

class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

# Forgot Password Schemas
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Registration Verification Schema
class VerifyRegistrationRequest(BaseModel):
    user_id: str
    code: str

# app/models.py - Add this class
class VerifyRegistrationRequest(BaseModel):
    user_id: str
    code: str