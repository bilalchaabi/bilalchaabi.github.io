document.addEventListener('DOMContentLoaded', function () {
    const showTextButton = document.getElementById('showTextButton');
    const copyTextButton = document.getElementById('copyTextButton');
    const displayText = document.getElementById('displayText');
    const copyNotification = document.getElementById('copyNotification');
    const complianceMessage = document.getElementById('complianceMessage');
    const positiveMessage = document.getElementById('positiveMessage');
    const sellRentYes = document.getElementById('sellRentYes');
    const sellRentNo = document.getElementById('sellRentNo');
    const disclaimerAgree = document.getElementById('disclaimerAgree');

    // Modal variables
    const modal = document.getElementById('disclaimerModal');
    const closeModalButton = document.getElementsByClassName('close')[0];
    const acceptDisclaimerButton = document.getElementById('acceptDisclaimerButton');
    const disclaimerAgreeModal = document.getElementById('disclaimerAgreeModal');

    // Show the modal as soon as the page loads
    modal.style.display = 'block';

    // Enable/disable the "Accept and Continue" button based on checkbox
    disclaimerAgreeModal.addEventListener('change', function () {
        acceptDisclaimerButton.disabled = !disclaimerAgreeModal.checked;
    });

    // Handle the "Accept and Continue" button
    acceptDisclaimerButton.addEventListener('click', function () {
        if (disclaimerAgreeModal.checked) {
            modal.style.display = 'none';
        }
    });

    // Initially disable the button if 'Yes' is selected by default
    if (sellRentYes.checked) {
        showTextButton.disabled = true;
    }

    // Event listener for the "Sell or Rent" question
    document.querySelectorAll('input[name="sellRent"]').forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.value === 'yes') {
                complianceMessage.style.display = 'block';
                positiveMessage.style.display = 'none';
                showTextButton.disabled = true;  // Disable the button
            } else {
                complianceMessage.style.display = 'none';
                positiveMessage.style.display = 'block';
                showTextButton.disabled = false; // Enable the button
            }
        });
    });

    const inputs = document.querySelectorAll('#textForm input, #stateDropdownForm select');
    
    // Add event listeners to all required fields
    inputs.forEach(input => {
        input.addEventListener('input', checkFormCompletion);
    });

    function checkFormCompletion() {
        const allFilled = Array.from(inputs).every(input => input.value.trim() !== '');
        showTextButton.disabled = !allFilled;
    }

    showTextButton.addEventListener('click', function () {
        const organization = document.getElementById('organization').value;
        const websiteURL = document.getElementById('websiteURL').value;
        const websiteName = document.getElementById('websiteName').value;
        const state = document.getElementById('state').value;

        const emailInput = document.getElementById('emailInput').value || '[No email provided]';
        const websiteInput = document.getElementById('websiteInput').value || '[No website URL provided]';
        const phoneInput = document.getElementById('phoneInput').value || '[No phone number provided]';
        const addressInput = document.getElementById('addressInput').value || '[No address provided]';

        if (!organization || !websiteURL || !websiteName || !state) {
            alert("Please fill out all required fields.");
            return;
        }

        const personalInfoList = generatePersonalInfoList();
        const contactInfoSection = generateContactInfoSection(emailInput, websiteInput, phoneInput, addressInput);
        const usageList = generateUsageList();

        const generatedText = createTemplate(
            organization, websiteURL, websiteName, state,
            personalInfoList, usageList, contactInfoSection
        );

        displayText.innerHTML = generatedText;
        copyTextButton.style.display = 'block'; // Show the copy button
    });

    copyTextButton.addEventListener('click', function () {
        copyToClipboard(displayText);
    });

    function copyToClipboard(element) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        try {
            document.execCommand('copy');
            showCopyNotification(); // Show custom notification
        } catch (err) {
            alert('Unable to copy text');
        }

        selection.removeAllRanges(); // Clear selection
    }

    function showCopyNotification() {
        copyNotification.style.display = 'block'; // Show the notification
        setTimeout(() => {
            copyNotification.style.display = 'none'; // Hide the notification after 5 seconds
        }, 5000);
    }

    document.querySelectorAll('input[name="source"]').forEach(checkbox => {
        checkbox.addEventListener('click', function () {
            toggleFreeform(this.dataset.toggleTarget);
        });
    });

    function toggleFreeform(freeformId) {
        const freeformElement = document.getElementById(freeformId);
        if (freeformElement) {
            freeformElement.style.display = freeformElement.style.display === "none" ? "block" : "none";
        }
    }

    function generatePersonalInfoList() {
        const selectedItems = [];
        const infoCheckboxes = document.querySelectorAll('form:nth-of-type(4) input[name="source"]:checked');

        infoCheckboxes.forEach((checkbox) => {
            const label = document.querySelector(`label[for="${checkbox.id}"]`);
            selectedItems.push(label.textContent);
        });

        return selectedItems.map(item => `<li>${item}</li>`).join('');
    }

    function generateContactInfoSection(email, website, phone, address) {
        const contactMethods = [];

        if (document.getElementById('email2').checked) {
            contactMethods.push(`<li><strong>Email Address:</strong> ${email}</li>`);
        }
        if (document.getElementById('checkboxWebsite').checked) {
            contactMethods.push(`<li><strong>Website:</strong> ${website}</li>`);
        }
        if (document.getElementById('phone2').checked) {
            contactMethods.push(`<li><strong>Phone Number:</strong> ${phone}</li>`);
        }
        if (document.getElementById('address2').checked) {
            contactMethods.push(`<li><strong>Address:</strong> ${address}</li>`);
        }

        if (contactMethods.length > 0) {
            return `<h3>Contact Information</h3>
            <p>If you have any questions about this privacy policy, please contact us at:
            <ul>
              ${contactMethods.join('')}
            </ul>
            </p>`;
        } else {
            return ''; // Return an empty string if no contact methods are selected
        }
    }

    const usageDescriptions = {
        provideProducts: "<strong>Provide Products and Services:</strong> Process payments, fulfill orders, and send notifications related to our products and services.",
        manageAccounts: "<strong>Create and Manage User Profiles and Accounts:</strong> Use personal information to establish and maintain user accounts.",
        personalizeExperience: "<strong>Personalize User Experience:</strong> Adapt interactions and content on our website based on user preferences and behavior.",
        communicate: "<strong>Communicate with Users:</strong> Send users marketing, promotional materials, and updates about our services.",
        complyLegal: "<strong>Comply with Legal Requirements:</strong> Ensure our practices align with legal standards and regulations.",
        enhanceSecurity: "<strong>Enhance Security:</strong> Monitor and prevent fraudulent activities to protect our services and users.",
        customerSupport: "<strong>Provide Customer Support:</strong> Offer assistance and resolve issues through direct communication with users.",
        analyzePerformance: "<strong>Analyze Performance and Usage:</strong> Evaluate how our services are accessed and used to improve functionality and user experience."
    };

    function generateUsageList() {
        const selectedUsages = [];
        const usageCheckboxes = document.querySelectorAll('form#usage-Form input[name="usage"]:checked');

        usageCheckboxes.forEach((checkbox) => {
            if (usageDescriptions[checkbox.value]) {
                selectedUsages.push(`<li>${usageDescriptions[checkbox.value]}</li>`);
            }
        });

        return selectedUsages.join('');
    }

    function createTemplate(organization, websiteURL, websiteName, state, personalInfoList, usageList, contactInfoSection) {
        const today = new Date();
        const dateString = today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `<h2>Privacy Policy</h2>
        <p>“${organization}” ("we", "us", or "our") operates the “${websiteName}” website (${websiteURL}) (the "Service"). This privacy policy explains how we collect, use, protect, and disclose information from users of our website.</p>
        <h3>Information Collection</h3>
        <p>We collect a variety of information from and about our users in order to provide, improve, and personalize our services. The types of information we collect include but are not limited to:
        <ul>
          ${personalInfoList}
          <li>Usage Data</li>
        </ul>
        </p>
        <h3>Methods of Collection</h3>
        <p>We collect information in several ways:
        <ul>
          <li><strong>Directly from You:</strong> When you register on our site, place an order, subscribe to our newsletter, fill out a form, subscribe to newsletters, make purchases, or contact customer support.</li>
          <li><strong>Automatically:</strong> As you navigate through our site, we automatically collect information about your equipment, browsing actions, and patterns, such as IP addresses, cookies, and usage details.</li>
          <li><strong>Public Sources:</strong> We may collect information about you from publicly accessible sources, such as social media profiles, government databases, and other online platforms. This information is used to verify the accuracy of data we already have, enhance user profiles, or provide more personalized services.</li>
          <li><strong>Communication and Feedback:</strong> We may collect information when you participate in surveys, provide feedback, or engage with us through social media platforms, email, or other communication channels.</li>
        </ul>
        <h3>Use of Information</h3>
        <p>We use the information collected for various purposes, including:
        <ul>
          ${usageList}
        </ul></p>
        
        <h3>Information Sharing and Disclosure</h3>
        <p>${organization} maintains strict privacy policies to protect the personal information of our users. This information is never sold, rented, released, or traded to others without prior consent or legal obligation. Any sharing of information with third parties is solely for the purpose of fulfilling the organization's obligations to the user. We guarantee that it will never be shared with third parties for marketing purposes.
        </p>
        <p>We may share your personal information in the following situations:</p>
        <ul>
            <li><strong>Service Providers:</strong> With third-party vendors or service providers who perform services on our behalf, such as payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.</li>
            <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, bankruptcy, or other transaction involving the sale or transfer of all or part of our assets, your personal information may be transferred as part of that transaction.</li>
            <li><strong>Legal Requirements:</strong> When required by law, such as to comply with a subpoena, court order, or other legal process.</li>
            <li><strong>Protecting Rights and Safety:</strong> When necessary to protect the rights, property, or safety of our company, our users, or others.</li>
            <li><strong>Affiliates:</strong> With our affiliates for internal business purposes.</li>
            <li><strong>Analytics and Advertising:</strong> With third-party analytics providers and advertising networks to deliver personalized ads and understand how users interact with our services.</li>
            <li><strong>Public Forums:</strong> Information shared in public forums may be visible to others.</li>
            <li><strong>Aggregate or Anonymized Information:</strong> We may share aggregate or anonymized information that cannot reasonably be used to identify you.</li>
        </ul>
        <h3>Information Protection</h3>
        <p>We are committed to ensuring the security of the personal information we collect. Our organization implements a variety of technical, administrative, and physical measures designed to protect your data from unauthorized access, disclosure, alteration, or destruction. These measures include but are not limited to:
        <ul>
          <li><strong>Encryption:</strong> We use industry-standard encryption protocols to protect sensitive data during transmission and in storage.</li>
          <li><strong>Access Controls:</strong> We restrict access to personal information to authorized personnel only, based on their role and need to know. This includes the use of authentication measures such as passwords, multi-factor authentication, and role-based access controls.</li>
          <li><strong>Monitoring and Auditing:</strong> Our systems are continuously monitored for potential vulnerabilities and threats. We conduct regular audits and assessments to ensure our security practices meet current standards and to identify areas for improvement.</li>
          <li><strong>Data Minimization:</strong> We limit the collection and retention of personal data to what is necessary for the purposes outlined in this policy. Data that is no longer needed is securely deleted or anonymized.</li>
          <li><strong>Third-Party Security:</strong> When we work with third-party service providers who process data on our behalf, we ensure that they have appropriate security measures in place to protect your information.</li>
        </ul>
        While we strive to protect your personal information, no method of transmission over the internet or electronic storage is 100% secure. Therefore, we cannot guarantee its absolute security. However, we continually update and improve our security practices to protect your data.</p>
        
        <h3>User Rights</h3>
        <p>You have the following rights regarding your personal information:
        <ul>
          <li><strong>Access:</strong> You can request a copy of the personal data we hold about you.</li>
          <li><strong>Correction:</strong> You can request that we correct any inaccurate or incomplete data.</li>
          <li><strong>Deletion:</strong> You can request that we delete your personal data.</li>
        </ul>
        To exercise these rights, please contact us using the contact information provided below.</p>
        <h3>Opt-Out</h3>
        <p>Users can opt-out of receiving future communications from us by:
        <ul>
          <li>Following the unsubscribe instructions included in each email</li>
          <li>Replying "Stop" to any text message to discontinue text message communications</li>
        </ul></p>
        <h3>Cookies and Tracking Technologies</h3>
            <p>We use cookies and similar tracking technologies to enhance your experience on our website, improve our services, and better understand how you interact with our content.</p>
            <h4>What Are Cookies?</h4>
            <p>Cookies are small text files that are placed on your device when you visit a website. They allow the website to recognize your device and remember certain information about your visit, such as your preferences and actions. Cookies can be "persistent" or "session" cookies. Persistent cookies remain on your device until they expire or are deleted, while session cookies are deleted when you close your browser.</p>
            <h4>How We Use Cookies and Tracking Technologies</h4>
            <p>We use cookies and tracking technologies for various purposes, including:</p>
            <ul>
                <li>Ensuring the security and integrity of our website.</li>
                <li>Remembering your preferences and settings.</li>
                <li>Analyzing site traffic and user behavior to improve our services.</li>
                <li>Delivering relevant advertising and marketing communications.</li>
                <li>Providing a personalized experience based on your interests and activities.</li>
            </ul>
            <p>You have the option to control and manage cookies in various ways. Most web browsers allow you to configure your cookie settings, including blocking or deleting cookies. However, please note that if you disable cookies, some features of our website may not function properly.</p>
        ${contactInfoSection}
        <h3>Changes to the Privacy Policy</h3>
            <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page. We advise you to review this privacy policy periodically for any changes.</p>
        <p>This privacy policy was generated by GetThru's Privacy Policy Generator.</p>

        <p>Last Updated: ${dateString}</p>`;
    }
});
