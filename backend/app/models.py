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

class TwoFactorLoginRequest(BaseModel):
    temp_token: str
    code: str

class ReportRequest(BaseModel):
    url: str
    note: str = ""

class ProfileUpdateRequest(BaseModel):
    name: str = ""
    email: str = ""

class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

class TwoFactorVerifyRequest(BaseModel):
    code: str