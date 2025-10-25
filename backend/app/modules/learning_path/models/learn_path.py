from enum import Enum, auto


class Topics(Enum):
    SFB_T = "Safe Browsing Practices"
    PS_T = "Password Security"
    M_T = "Malware"
    SE_T = "Social Engineering"
    IR_T = "Incident Response"

class SubtopicPriority(Enum):
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"

class Subtopic(Enum):
    #SFB_T
    SECVSNONSEC = "SECVSNONSEC"
    HTTPVSHTTPS = "HTTPVSHTTPS"
    BROWSERSECBP = "BROWSERSECBP"

    # PS_T
    COMMPASS = "COMMPASS"
    PASSSTREN = "PASSSTREN"
    MULTIFACT = "MULTIFACT"

    # M_T
    MALTYPE = "MALTYPE"
    MALINFECT = "MALINFECT"

    # SE_T
    SOCENGTYPE = "SOCENGTYPE"
    SOCENGDEF = "SOCENGDEF"

    # IR_T
    IRPROC = "IRPROC"
    IRPREP = "IRPREP"
    IRPOST = "IRPOST"
    PIRPLAN = "PIRPLAN"