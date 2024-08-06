document.addEventListener('DOMContentLoaded', function() {
  const showTextButton = document.getElementById('showTextButton');
  const copyTextButton = document.getElementById('copyTextButton');
  const displayText = document.getElementById('displayText');
  const copyNotification = document.getElementById('copyNotification');

  showTextButton.addEventListener('click', function() {
      const organization = document.getElementById('organization').value;
      const websiteURL = document.getElementById('websiteURL').value;
      const websiteName = document.getElementById('websiteName').value;
      const state = document.getElementById('state').value;

      const emailInput = document.getElementById('emailInput').value || '[No email provided]';
      const websiteInput = document.getElementById('websiteInput').value || '[No website URL provided]';
      const phoneInput = document.getElementById('phoneInput').value || '[No phone number provided]';
      const addressInput = document.getElementById('addressInput').value || '[No address provided]';

      const personalInfoList = generatePersonalInfoList();
      const contactInfoSection = generateContactInfoSection(emailInput, websiteInput, phoneInput, addressInput);

      const generatedText = createTemplate(
          organization, websiteURL, websiteName, state,
          personalInfoList, contactInfoSection
      );

      displayText.innerHTML = generatedText;
      copyTextButton.style.display = 'block'; // Show the copy button
  });

  copyTextButton.addEventListener('click', function() {
      copyToClipboard(displayText);
  });

  // Function to copy HTML content to clipboard
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

  // Function to show the custom copy notification
  function showCopyNotification() {
      copyNotification.style.display = 'block'; // Show the notification
      setTimeout(() => {
          copyNotification.style.display = 'none'; // Hide the notification after 3 seconds
      }, 3000);
  }

  // Toggle functionality for freeform fields
  document.querySelectorAll('input[name="source"]').forEach(checkbox => {
      checkbox.addEventListener('click', function() {
          toggleFreeform(this.dataset.toggleTarget);
      });
  });

  // Function to toggle the visibility of freeform input sections
  function toggleFreeform(freeformId) {
      const freeformElement = document.getElementById(freeformId);
      if (freeformElement) {
          freeformElement.style.display = freeformElement.style.display === "none" ? "block" : "none";
      }
  }

  // Function to generate the list of personal information collected
  function generatePersonalInfoList() {
      const selectedItems = [];
      const infoCheckboxes = document.querySelectorAll('form:nth-of-type(3) input[name="source"]:checked');

      infoCheckboxes.forEach((checkbox) => {
          const label = document.querySelector(`label[for="${checkbox.id}"]`);
          selectedItems.push(label.textContent);
      });

      return selectedItems.map(item => `<li>${item}</li>`).join('');
  }

  // Function to generate the contact information section
  function generateContactInfoSection(email, website, phone, address) {
      const contactMethods = [];

      if (document.getElementById('email2').checked) {
          contactMethods.push(`<li>Email: ${email}</li>`);
      }
      if (document.getElementById('checkboxWebsite').checked) {
          contactMethods.push(`<li>Website: ${website}</li>`);
      }
      if (document.getElementById('phone2').checked) {
          contactMethods.push(`<li>Phone: ${phone}</li>`);
      }
      if (document.getElementById('address2').checked) {
          contactMethods.push(`<li>Address: ${address}</li>`);
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

  // Function to create the privacy policy template
  function createTemplate(organization, websiteURL, websiteName, state, personalInfoList, contactInfoSection) {
      const today = new Date();
      const dateString = today.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
      });

      return `<h2>Privacy Policy</h2>
      <p>“${organization}” ("we", "us", or "our") operates the “${websiteName}” website (${websiteURL}) (the "Service"). This privacy policy explains how we collect, use, protect, and disclose information from users of our website.</p>
      <h3>Information Collection</h3>
      <p>We collect various types of personal information, including but not limited to:
      <ul>
        ${personalInfoList}
      </ul>
      </p>
      <h3>Usage Data</h3>
      <p>Methods of Collection
      We collect information in several ways:
      <ul>
        <li>Directly from You: When you register on our site, place an order, subscribe to our newsletter, fill out a form, or provide feedback.</li>
        <li>Automatically: As you navigate through our site, we automatically collect information about your equipment, browsing actions, and patterns, such as IP addresses, cookies, and usage details.</li>
      </ul>
      <h3>Use of Information</h3>
      <p>We use the information collected for various purposes, including:
      <ul>
        <li>To process transactions</li>
        <li>To improve our website</li>
        <li>To send periodic emails to ${emailInput}</li>
        <li>To personalize user experience on ${websiteInput}</li>
        <li>To contact users via phone: ${phoneInput}</li>
        <li>To send postal mail to: ${addressInput}</li>
      </ul>
      [Additional Uses Based on User Input]</p>
      <h3>Legal Basis for Processing</h3>
      <p>We process personal data based on the following legal bases:
      <ul>
        <li>User consent</li>
        <li>Necessity for the performance of a contract</li>
        <li>Compliance with legal obligations</li>
        <li>Legitimate interests</li>
      </ul></p>
      <h3>Information Protection</h3>
      <p>We implement a variety of security measures to protect your personal information, including:
      <ul>
        <li>Encryption</li>
        <li>Secure servers</li>
        <li>Restricted access</li>
      </ul>
      [Additional Security Measures]</p>
      <h3>Information Sharing and Disclosure</h3>
      <p>${organization} maintains strict privacy policies to protect the personal information of our users. This information is never sold, rented, released, or traded to others without prior consent or legal obligation. Any sharing of information with third parties is solely for the purpose of fulfilling the organization's obligations to the user. We guarantee that it will never be shared with third parties for marketing purposes.
      </p>

      <p>We may share your personal information in the following situations:</p>
      
      <ul>
      <li>With trusted partners who assist us in operating our website, conducting our business, or serving our users, provided that those parties agree to keep this information confidential</li>
      <li>When required by law, to enforce our site policies, or to protect our or others' rights, property, or safety</li>
      </ul>
      <h3>User Rights</h3>
      <p>You have the following rights regarding your personal information:
      <ul>
        <li>Access: You can request a copy of the personal data we hold about you.</li>
        <li>Correction: You can request that we correct any inaccurate or incomplete data.</li>
        <li>Deletion: You can request that we delete your personal data.</li>
        <li>Objection: You can object to our processing of your personal data.</li>
        <li>Restriction: You can request that we restrict the processing of your personal data.</li>
        <li>Portability: You can request that we transfer your personal data to another organization.</li>
      </ul>
      To exercise these rights, please contact us using the contact information provided below.</p>
      <h3>Opt-Out</h3>
      <p>Users can opt-out of receiving future communications from us by:
      <ul>
        <li>Following the unsubscribe instructions included in each email</li>
        <li>Contacting us directly at ${emailInput}</li>
      </ul></p>
      <h3>Cookies and Tracking Technologies</h3>
      <p>We use cookies and similar tracking technologies to enhance your experience on our website. You can control cookie preferences through your browser settings.</p>
      <h3>Changes to the Privacy Policy</h3>
      <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page. We advise you to review this privacy policy periodically for any changes.</p>
      ${contactInfoSection}
      <p>Last Updated: ${dateString}</p>`;
  }
});
