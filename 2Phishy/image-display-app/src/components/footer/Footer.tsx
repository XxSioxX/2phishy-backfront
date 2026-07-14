import { useBranding } from "../../contexts/BrandingContext"
import "./footer.scss"

const Footer = () => {
    const { branding } = useBranding();

    return(
        <div className="footer">
            <span> {branding.institution_name} </span>
            <span> (c) {branding.system_name} by Group AP </span>
        </div>
        
    )
}

export default Footer
